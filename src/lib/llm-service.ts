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
    // CoT: Hypothesis: Generate everything in one Groq call. Cons: Prompt drift, schema violations.
    // Selected: Call generateTextAnalysis in parallel for each selected option to ensure 100% adherence to single-type 4-stage schema.
    let hasFlashcards = options.includes('flashcards') || options.length === 0;
    let hasQuiz = options.includes('quiz') || options.length === 0;
    let hasNotes = options.includes('notes');
    let hasTutorLesson = options.includes('tutorlesson');
    let hasFillInTheBlanks = options.includes('fillintheblanks');

    const promises: Promise<{ key: string, data: any }>[] = [];

    if (hasFlashcards) {
        promises.push(generateTextAnalysis(fileContent, "flashcards", "Génère des flashcards (front/back)", false)
            .then(res => ({ key: 'flashcards', data: res.data?.items })));
    }
    if (hasQuiz) {
        promises.push(generateTextAnalysis(fileContent, "quiz", "Génère un quiz à choix multiples", false)
            .then(res => ({ key: 'quiz', data: res.data?.items })));
    }
    if (hasNotes) {
        promises.push(generateTextAnalysis(fileContent, "cornell", "Génère des notes Cornell", false)
            .then(res => ({ key: 'notes', data: res.data?.items?.length ? res.data?.items[0] : res.data?.items })));
    }
    if (hasTutorLesson) {
        promises.push(generateTextAnalysis(fileContent, "tutor_response", "Crée une introduction socratique", false)
            .then(res => ({ key: 'tutorLesson', data: res.data?.items })));
    }
    if (hasFillInTheBlanks) {
        promises.push(generateTextAnalysis(fileContent, "fill_in_blanks", "Génère un exercice à trous", false)
            .then(res => ({ key: 'fillInTheBlanks', data: res.data?.items })));
    }

    const results = await Promise.allSettled(promises);
    const words = fileContent.split(/\s+/).filter(w => w.length > 4);

    const output: any = {
        id: 'set_' + Date.now(),
        title: fileName.replace(/\.[^/.]+$/, ''),
        sourceName: fileName,
        generatedBy: 'Groq Multi-Agent',
        stats: {
            wordCount: words.length,
            characterCount: fileContent.length,
            cardCount: 0,
            quizCount: 0,
        },
        flashcards: null,
        quiz: null,
        notes: null,
        tutorLesson: null,
        fillInTheBlanks: null
    };

    results.forEach(res => {
        if (res.status === 'fulfilled' && !res.value.data?.error) {
            output[res.value.key] = res.value.data;
        } else if (res.status === 'rejected') {
            console.error(`Error generating one of the parts:`, res.reason);
        }
    });

    output.stats.cardCount = output.flashcards?.length || 0;
    output.stats.quizCount = output.quiz?.length || 0;

    return output;
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

export const chatTutor = async (context: string, documentContent: string, userMessage: string) => {
    const fullQuery = `Historique de conversation:\n${context}\n\nMessage actuel de l'étudiant:\n${userMessage}`;
    const result = await generateTextAnalysis(documentContent, "tutor_response", fullQuery, true);

    // Formatting the JSON output to text for the frontend component (since frontend expects a string reply in API)
    // Or we can return JSON and let frontend format it. Let's return the string format or JSON.
    // The instructions say EVERY generation must return STRICTLY VALID JSON. So the API returns JSON.
    // We'll return the parsed object from generateTextAnalysis.

    let replyText = "";
    if (result.data?.items) {
        const item = Array.isArray(result.data.items) ? result.data.items[0] : result.data.items;
        if (item.response) replyText += item.response + "\n\n";
        if (item.nextQuestion) replyText += "*" + item.nextQuestion + "*";
        if (!replyText && item) replyText = typeof item === 'string' ? item : JSON.stringify(item);
    } else if (result.error) {
        replyText = "Erreur: " + result.error;
    } else {
        replyText = "Aucune réponse générée.";
    }

    // Embed progress info in text for now, or just return text
    return `*(✨ Propulsé par ${result.provider})*\n\n${replyText}`;
};

const CENTRAL_SYSTEM_PROMPT = `Tu es un tuteur pédagogique expert français, précis, rigoureux et inspiré de Studley AI. Adopte ce rôle strictement: un éducateur socratique qui guide l'étudiant via questions actives pour favoriser le rappel actif, sans jamais révéler les réponses directement sauf si demandé explicitement après tentative.
Tu analyses UNIQUEMENT le texte fourni par l'étudiant. Tu ne devines jamais, tu n'hallucines jamais, tu ne parles jamais de toi-même, de Nura AI, ou de tout sujet externe. Si quelque chose n'est pas dans le texte, retourne IMMÉDIATEMENT {"error": "Pas dans le texte fourni"}.
Pense étape par étape (chain-of-thought): 1. Identifie les concepts clés du texte. 2. Vérifie si la requête est couverte. 3. Génère 2-3 variantes de réponse. 4. Sélectionne la meilleure (self-consistency). 5. Valide contre schémas Zod.
Réponds EXCLUSIVEMENT avec un objet JSON valide et rien d'autre :
{
  "type": "flashcards" | "quiz" | "cornell" | "tutor_response" | "analysis" | "fill_in_blanks",
  "items": array of objects (strictly 3-10 items max, grounded in text),
  "progress": {
    "currentStage": "unfamiliar" | "learning" | "familiar" | "mastery",
    "score": number between 0-100,
    "nextStageUnlocked": boolean,
    "pipelineBars": array of {stage: string, completed: boolean}
  },
  "error": string (only if applicable)
}
Règles strictes et exemples (few-shot):
- Flashcards: Toujours tableau d'objets { "front": "Question claire et précise en français", "back": "Réponse complète et exacte en français, avec explication courte" } — jamais juste une question. Exemple: [{"front": "Qu'est-ce que la photosynthèse?", "back": "Processus par lequel les plantes convertissent la lumière en énergie, selon le texte."}]
- Quiz: Toujours 4 choix (array de strings) + "correctAnswer": index (0-3) + "explanation": string courte en français. Exemple: {"question": "Capitale de la France?", "options": ["Paris", "Londres", "Berlin", "Madrid"], "correctAnswer": 0, "explanation": "Selon le texte, Paris est la capitale."}
- Cornell: { "cues": array de questions clés, "notes": string détaillé, "summary": string court, tout en français }
- Tutor: Réponse socratique courte en français + une question de rappel active pour faire avancer le stage. Exemple: {"response": "Pense à ce que dit le texte sur X. Quelle est ta réponse?", "nextQuestion": "Explique Y en tes mots."}
- Fill-in-blanks: Tableau d'objets { "sentence": "Phrase avec _____", "answer": "Réponse exacte", "hint": "Indice du texte" }
- Analysis: Résumé structuré avec points clés, tout en français.
Toujours respecter les 4 stages: L'utilisateur doit répondre correctement (valider via comparaison) pour passer au stage suivant; inclure logique de progression dans JSON.
Si le texte est en français, tout en français. Limite à contenu éducatif, précis, engageant. Constraints: Pas plus de 500 tokens par item, éviter répétitions.`;

export const UnifiedOutputSchema = z.object({
    type: z.enum(["flashcards", "quiz", "cornell", "tutor_response", "analysis", "fill_in_blanks"]),
    items: z.any().optional(),
    progress: z.object({
        currentStage: z.enum(["unfamiliar", "learning", "familiar", "mastery"]),
        score: z.number().min(0).max(100),
        nextStageUnlocked: z.boolean(),
        pipelineBars: z.array(z.object({
            stage: z.string(),
            completed: z.boolean()
        }))
    }).optional(),
    error: z.string().optional()
});

export async function generateTextAnalysis(
    text: string,
    requestedType: "flashcards" | "quiz" | "cornell" | "tutor_response" | "analysis" | "fill_in_blanks" = "analysis",
    userQuery: string = "",
    useQualityModel: boolean = false
) {
    // Chain-of-thought: 
    // Hypothesis 1: Injecting only the user query without the requested type. Pros: Simple. Cons: The model might output the wrong schema type.
    // Hypothesis 2: Injecting the exact requestedType and forcing JSON mode. Pros: Guaranteed structure, strong grounding. Cons: Requires strict Zod validation.
    // Selected: Hypothesis 2, using the central prompt and explicit type injection to ensure 0 hallucinations and exact format.

    let modelPreference = useQualityModel
        ? ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
        : ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];

    const prompt = `
${CENTRAL_SYSTEM_PROMPT}

TYPE DEMANDÉ : ${requestedType}
${userQuery ? `REQUÊTE UTILISATEUR / CONTEXTE : ${userQuery}` : ''}

TEXTE À ANALYSER (UNIQUE SOURCE DE VÉRITÉ) :
${text.substring(0, 30000)}

Instructions finales: Génère UNIQUEMENT un objet JSON valide correspondant au type "${requestedType}" demandé. Retourne l'erreur "Pas dans le texte fourni" si le texte ne permet pas de générer le contenu de manière fiable.
`;

    const { text: rawJson, modelLabel } = await smartGenerate(prompt, true, modelPreference);

    try {
        const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
        const parsedJson = JSON.parse(clean);

        if (parsedJson.error) {
            return { error: parsedJson.error, provider: modelLabel };
        }

        const validatedData = UnifiedOutputSchema.parse(parsedJson);

        return {
            provider: modelLabel,
            data: validatedData
        };
    } catch (err: any) {
        console.error("Erreur de parsing JSON ou de validation Zod :", err);
        throw new Error("L'IA n'a pas retourné le format attendu ou un problème de parsing est survenu.");
    }
}
