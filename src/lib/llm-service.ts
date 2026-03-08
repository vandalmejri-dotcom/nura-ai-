// src/lib/llm-service.ts
import { z } from 'zod';

/**
 * Nura AI — Smart Multi-Model LLM Service with Quota Management (TypeScript Port)
 */

export interface Model {
    id: string;
    label: string;
    rpm: number;
    rpd: number;
    tpm: number;
    priority: number;
    provider?: 'gemini' | 'groq';
}

const MODELS: Model[] = [
    {
        id: 'llama-3.1-8b-instant',
        label: 'Groq Llama 3.1 8B',
        rpm: 30,
        rpd: 14400,
        tpm: 1_000_000,
        priority: 1,
        provider: 'groq',
    },
    {
        id: 'llama-3.3-70b-versatile',
        label: 'Groq Llama 3.3 70B',
        rpm: 30,
        rpd: 14400,
        tpm: 1_000_000,
        priority: 2,
        provider: 'groq',
    },
    {
        id: 'gemini-1.5-flash',
        label: 'Gemini 1.5 Flash',
        rpm: 15,
        rpd: 1500,
        tpm: 1_000_000,
        priority: 3,
        provider: 'gemini',
    },
    {
        id: 'gemini-2.0-flash-lite-preview-02-05',
        label: 'Gemini 2.0 Flash Lite',
        rpm: 30,
        rpd: 1500,
        tpm: 1_000_000,
        priority: 4,
        provider: 'gemini',
    },
    {
        id: 'gemini-1.5-pro',
        label: 'Gemini 1.5 Pro',
        rpm: 2,
        rpd: 50,
        tpm: 32_000,
        priority: 5,
        provider: 'gemini',
    }
];


interface UsageRecord {
    recent: number[];
    dailyCount: number;
    dayStart: number;
    exhaustedToday: boolean;
}

class QuotaManager {
    private usage: Record<string, UsageRecord> = {};

    constructor() {
        MODELS.forEach(m => {
            this.usage[m.id] = {
                recent: [],
                dailyCount: 0,
                dayStart: this._todayUTC(),
                exhaustedToday: false,
            };
        });
    }

    private _todayUTC() {
        const now = new Date();
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    }

    private _maybeResetDay(modelId: string) {
        const u = this.usage[modelId];
        const today = this._todayUTC();
        if (u.dayStart < today) {
            u.dailyCount = 0;
            u.dayStart = today;
            u.exhaustedToday = false;
            u.recent = [];
            console.log(`🔄 Daily quota reset for ${modelId}`);
        }
    }

    private _pruneRecent(modelId: string) {
        const cutoff = Date.now() - 60_000;
        this.usage[modelId].recent = this.usage[modelId].recent.filter(t => t > cutoff);
    }

    canUse(model: Model) {
        this._maybeResetDay(model.id);
        const u = this.usage[model.id];
        if (u.exhaustedToday) return false;
        if (u.dailyCount >= model.rpd) return false;
        this._pruneRecent(model.id);
        if (u.recent.length >= model.rpm) return false;
        return true;
    }

    recordSuccess(modelId: string) {
        const u = this.usage[modelId];
        u.recent.push(Date.now());
        u.dailyCount++;
    }

    markExhausted(modelId: string) {
        this.usage[modelId].exhaustedToday = true;
        console.warn(`⛔ ${modelId} marked exhausted for today.`);
    }

    secondsUntilAvailable(model: Model) {
        this._pruneRecent(model.id);
        const u = this.usage[model.id];
        if (u.recent.length < model.rpm) return 0;
        const oldest = Math.min(...u.recent);
        return Math.ceil((oldest + 60_000 - Date.now()) / 1000);
    }

    pickModel(preferenceList: string[]) {
        for (const modelId of preferenceList) {
            const model = MODELS.find(m => m.id === modelId);
            if (model && this.canUse(model)) return model;
        }
        return null;
    }

    getStatus() {
        return MODELS.map(m => {
            this._maybeResetDay(m.id);
            this._pruneRecent(m.id);
            const u = this.usage[m.id];
            return {
                id: m.id,
                label: m.label,
                available: this.canUse(m),
                dailyUsed: u.dailyCount,
                dailyLimit: m.rpd,
                dailyRemaining: Math.max(0, m.rpd - u.dailyCount),
                rpmUsed: u.recent.length,
                rpmLimit: m.rpm,
                exhaustedToday: u.exhaustedToday,
            };
        });
    }
}

// In-memory singleton (lost on serverless restart, but good for base port)
export const quota = new QuotaManager();

const STUDY_SET_PREF = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemini-1.5-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-1.5-pro'];
const CHAT_PREF = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemini-1.5-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-1.5-pro'];


async function callGemini(model: Model, prompt: string, jsonMode: boolean): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('No Gemini API key configured.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`;

    const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
    };
    if (jsonMode) {
        body.generationConfig = { responseMimeType: 'application/json' };
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        const status = res.status;
        if (status === 429 || status === 403) {
            quota.markExhausted(model.id);
        }
        throw new Error(`[${model.label}] HTTP ${status}: ${errText.substring(0, 250)}`);
    }

    const data = await res.json();
    if (!data.candidates?.length) throw new Error(`[${model.label}] No candidates returned.`);

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY') throw new Error(`[${model.label}] Blocked by safety filters.`);

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`[${model.label}] Empty text in response.`);

    return text;
}

async function callOllama(prompt: string, jsonMode: boolean) {
    const finalPrompt = jsonMode
        ? prompt + '\n\nCRITICAL: Output ONLY valid minified JSON. No markdown. No backticks. No other text.'
        : prompt;

    const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: finalPrompt, stream: false }),
    });

    if (!res.ok) throw new Error('Ollama is not running.');
    const data = await res.json();
    return { text: data.response, modelLabel: 'Llama 3 (local)' };
}

async function callGroq(model: Model, prompt: string, jsonMode: boolean): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('No Groq API key configured.');

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const body: any = {
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
    };
    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        const status = res.status;
        if (status === 429 || status === 403) {
            quota.markExhausted(model.id);
        }
        throw new Error(`[${model.label}] HTTP ${status}: ${errText.substring(0, 250)}`);
    }

    const data = await res.json();
    if (!data.choices?.length) throw new Error(`[${model.label}] No candidates returned.`);

    const text = data.choices[0]?.message?.content;
    if (!text) throw new Error(`[${model.label}] Empty text in response.`);

    return text;
}

export async function smartGenerate(prompt: string, jsonMode: boolean, preferenceList: string[]) {
    const errors: string[] = [];

    while (true) {
        const model = quota.pickModel(preferenceList);

        if (!model) {
            const waits = MODELS.map(m => ({
                label: m.label,
                secs: quota.secondsUntilAvailable(m),
                rpd: m.rpd,
                dailyRemaining: Math.max(0, m.rpd - (quota as any).usage[m.id].dailyCount),
            }));
            const soonest = waits.filter(w => w.dailyRemaining > 0).sort((a, b) => a.secs - b.secs)[0];
            if (soonest && soonest.secs <= 15) {
                await new Promise(r => setTimeout(r, soonest.secs * 1000 + 500));
                continue;
            }
            break;
        }

        try {
            const text = model.provider === 'groq'
                ? await callGroq(model, prompt, jsonMode)
                : await callGemini(model, prompt, jsonMode);
            quota.recordSuccess(model.id);
            return { text, modelLabel: model.label };
        } catch (err: any) {
            errors.push(err.message);
        }
    }

    try {
        return await callOllama(prompt, jsonMode);
    } catch (err: any) {
        errors.push(`Ollama: ${err.message}`);
    }

    throw new Error('All AI providers are unavailable.\n' + errors.join('\n'));
}

export const generateStudySet = async (fileName: string, fileContent: string, options: string[] = [], language = 'en') => {
    const langMap: any = { en: 'US English', es: 'Spanish', fr: 'French', de: 'German', zh: 'Chinese' };
    const langStr = langMap[language] || 'English';

    let hasFlashcards = options.includes('flashcards');
    let hasQuiz = options.includes('quiz');
    let hasNotes = options.includes('notes');
    let hasPodcast = options.includes('podcast');
    let hasTutorLesson = options.includes('tutorlesson');
    let hasWrittenTests = options.includes('writtentests');
    let hasFillInTheBlanks = options.includes('fillintheblanks');

    if (options.length === 0) {
        hasFlashcards = true;
        hasQuiz = true;
    }

    let schemaProps: string[] = [];
    if (hasFlashcards) schemaProps.push(`"flashcards": [{"front": "Atomic term/question (testing ONE concept)", "back": "Concise answer"}]`);
    if (hasQuiz) schemaProps.push(`"quiz": [{"question": "Atomic multiple choice question", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 0, "rationale": "Scientific rationale for the answer"}]`);
    if (hasNotes) schemaProps.push(`"notes": "# Cornell Notes Title\\n\\n## Cues\\n- Cue 1\\n\\n## Notes\\nDetailed notes with markdown formatting and bullet points."`);
    if (hasPodcast) schemaProps.push(`"podcast": "**Host 1:** Script..."`);
    if (hasTutorLesson) schemaProps.push(`"tutorLesson": "## Lesson..."`);
    if (hasWrittenTests) schemaProps.push(`"writtenTests": "## Test..."`);
    if (hasFillInTheBlanks) schemaProps.push(`"fillInTheBlanks": "... ____ ... (Answer: ...)"`);

    const pFormat = `{\n  ${schemaProps.join(',\n  ')},\n  "stats": {"cardCount": 10, "quizCount": 5}\n}`;

    const prompt = `FULL EXTRACTED TEXT FROM USER PDF (length: ${fileContent.length} chars):
${fileContent.substring(0, 100000)}

Now extract concepts, build Anki flashcards, Cornell notes, quizzes, fill-in-the-blanks exactly like Studley.ai.

You are an expert pedagogical AI. Generate a study set in ${langStr} from: ${fileName}

CRITICAL CONSTRAINTS FOR SPACED REPETITION:
1. NO LaTeX. Plain text math only.
2. ATOMICITY: Every flashcard and quiz question MUST test a single, isolated fact. NEVER create compound questions that test multiple discrete facts simultaneously.
3. OUTPUT STRICT JSON matching this exact schema:
${pFormat}`;

    const { text: raw, modelLabel } = await smartGenerate(prompt, true, STUDY_SET_PREF);

    const StudySetOutputSchema = z.object({
        stats: z.object({
            cardCount: z.number().optional(),
            quizCount: z.number().optional()
        }).optional(),
        flashcards: z.array(z.object({
            front: z.string(),
            back: z.string()
        })).optional(),
        quiz: z.array(z.object({
            question: z.string(),
            options: z.array(z.string()),
            correctAnswerIndex: z.number(),
            rationale: z.string().optional()
        })).optional(),
        notes: z.string().optional(),
        podcast: z.string().optional(),
        tutorLesson: z.string().optional(),
        writtenTests: z.string().optional(),
        fillInTheBlanks: z.string().optional()
    });

    try {
        const clean = raw.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
        const parsedJson = JSON.parse(clean);
        const parsed = StudySetOutputSchema.parse(parsedJson);
        const words = fileContent.split(/\s+/).filter(w => w.length > 4);

        return {
            id: 'set_' + Date.now(),
            title: fileName.replace(/\.[^/.]+$/, ''),
            sourceName: fileName,
            generatedBy: modelLabel,
            stats: {
                wordCount: words.length,
                characterCount: fileContent.length,
                cardCount: parsed.stats?.cardCount ?? parsed.flashcards?.length ?? 0,
                quizCount: parsed.stats?.quizCount ?? parsed.quiz?.length ?? 0,
            },
            flashcards: parsed.flashcards ?? null,
            quiz: parsed.quiz ?? null,
            notes: parsed.notes ?? null,
            podcast: parsed.podcast ?? null,
            tutorLesson: parsed.tutorLesson ?? null,
            writtenTests: parsed.writtenTests ?? null,
            fillInTheBlanks: parsed.fillInTheBlanks ?? null
        };
    } catch (err) {
        throw new Error('AI output parse failed.');
    }
};

export async function checkProviderStatus() {
    const geminiModels = quota.getStatus();
    const bestGemini = geminiModels.find(m => m.available);

    // Quick ping for Ollama
    let ollamaAvailable = false;
    try {
        const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        ollamaAvailable = r.ok;
    } catch (_) { }

    return {
        gemini: {
            available: !!bestGemini,
            activeModel: bestGemini?.label ?? null,
            models: geminiModels,
        },
        ollama: { available: ollamaAvailable },
        totalDailyRemaining: geminiModels.reduce((s, m) => s + m.dailyRemaining, 0),
    };
}

export const chatTutor = async (fileName: string, documentContent: string, userMessage: string) => {
    const prompt = `You are a Socratic AI Mentor. Guide the student on "${fileName}".\n\nContent:\n${documentContent.substring(0, 20000)}\n\nStudent: "${userMessage}"\n\nRules: Markdown, no JSON, no LaTeX.`;
    const { text, modelLabel } = await smartGenerate(prompt, false, CHAT_PREF);
    return `*(✨ Powered by ${modelLabel})*\n\n${text}`;
};

const TextAnalysisSchema = z.object({
    concepts: z.array(z.string()),
    flashcards: z.array(z.object({
        front: z.string(),
        back: z.string()
    })),
    cornell: z.object({
        cues: z.array(z.string()),
        notes: z.string(),
        summary: z.string()
    })
});

export async function generateTextAnalysis(text: string) {
    const prompt = `
Tu es un tuteur pédagogique IA expert. Ton rôle est d'analyser le texte fourni par l'étudiant et de générer un matériel d'étude structuré au format JSON.

Analyse le texte suivant et génère EXACTEMENT cette structure JSON, sans aucun autre texte avant ou après :
{
  "concepts": [
    "Concept ou terme clé 1",
    "Concept ou terme clé 2"
  ],
  "flashcards": [
    { "front": "Question testant un seul fait précis ?", "back": "Réponse courte et concise." }
  ],
  "cornell": {
    "cues": ["Mots-clés", "Questions principales"],
    "notes": "Tes notes détaillées avec des points de repère ou listes.",
    "summary": "Un bref paragraphe résumant l'ensemble du texte."
  }
}

Règles strictes :
1. Extrait 10 à 15 flashcards maximum.
2. Les flashcards doivent tester un seul concept à la fois (atomiques).
3. Les notes Cornell doivent être très claires.
4. Réponds UNIQUEMENT avec du JSON valide. N'ajoute pas de balises markdown comme \`\`\`json\` autour de ta réponse.

TEXTE À ANALYSER :
${text.substring(0, 50000)}
`;

    const { text: rawJson, modelLabel } = await smartGenerate(prompt, true, ['llama-3.1-8b-instant']);

    try {
        const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
        const parsedJson = JSON.parse(clean);

        const validatedData = TextAnalysisSchema.parse(parsedJson);

        return {
            provider: modelLabel,
            data: validatedData
        };
    } catch (err: any) {
        console.error("Erreur de parsing JSON ou de validation Zod :", err);
        throw new Error("L'IA n'a pas retourné le format attendu.");
    }
}
