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
        signal: AbortSignal.timeout(8000), // 8s timeout to keep within Vercel's 10s limit
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
        signal: AbortSignal.timeout(8000), // 8s timeout
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

    let attempts = 0;
    while (attempts < 2) { // Maximum 2 attempts total to avoid 10s Vercel timeout
        attempts++;
        const model = quota.pickModel(preferenceList);

        if (!model) {
            console.warn('[smartGenerate] No models available or all rate-limited.');
            break;
        }

        try {
            const text = model.provider === 'groq'
                ? await callGroq(model, prompt, jsonMode)
                : await callGemini(model, prompt, jsonMode);
            quota.recordSuccess(model.id);
            console.log(`[smartGenerate] Model: ${model.label}, Response (start): ${text.substring(0, 200)}...`);
            return { text, modelLabel: model.label };
        } catch (err: any) {
            console.error(`[smartGenerate] Attempt ${attempts} failed (${model.label}):`, err.message);
            errors.push(`${model.label}: ${err.message}`);
            // If it's a timeout or quota, don't try too many more models
            if (err.name === 'TimeoutError' || err.message.includes('429')) {
                // Continue to next attempt
            }
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
    // LLM Optimization: Only generate modules selected by the user
    // Terms: AI Synthesis, Flashcards, Quiz Arena, Fill in the Blanks, Podcast, AI Tutor
    const hasFlashcards = options.includes('flashcards') || options.length === 0;
    const hasQuiz = options.includes('quiz_arena') || options.length === 0;
    const hasSynthesis = options.includes('ai_synthesis') || options.length === 0;
    const hasFillInTheBlanks = options.includes('fill_in_the_blanks') || options.length === 0;
    const hasAITutor = options.includes('ai_tutor');
    const hasPodcast = options.includes('podcast');

    const promises: Promise<{ key: string, data: any, language?: string }>[] = [];

    if (hasFlashcards) {
        promises.push(generateTextAnalysis(fileContent, "flashcards", "Génère des flashcards (front/back)", false)
            .then(res => ({ key: 'flashcards', data: res.data?.items, language: res.data?.detectedLanguage })));
    }
    if (hasQuiz) {
        promises.push(generateTextAnalysis(fileContent, "quiz", "Génère un quiz à choix multiples (Deep Testing)", false)
            .then(res => ({ key: 'quiz', data: res.data?.items, language: res.data?.detectedLanguage })));
    }
    if (hasSynthesis) {
        promises.push(generateTextAnalysis(fileContent, "synthesized_notes", "Transforme ce contenu en notes synthétisées structurées (Core Mechanics)", true)
            .then(res => ({ key: 'synthesizedNotes', data: res.data?.items, language: res.data?.detectedLanguage })));
    }
    if (hasFillInTheBlanks) {
        promises.push(generateTextAnalysis(fileContent, "fill_in_blanks", "Génère un exercice à trous (Cloze test/FIB).", false)
            .then(res => {
                let data = res.data?.items;
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    data = data.items || data.questions || Object.values(data).find(Array.isArray) || [];
                }
                return { key: 'fillInTheBlanks', data: Array.isArray(data) ? data : [], language: res.data?.detectedLanguage };
            }));
    }
    if (hasAITutor) {
        promises.push(generateTextAnalysis(fileContent, "tutor_response", "Crée une introduction socratique interactive (AI Tutor)", false)
            .then(res => ({ key: 'tutorLesson', data: res.data?.items, language: res.data?.detectedLanguage })));
    }
    if (hasPodcast) {
        promises.push(generateTextAnalysis(fileContent, "analysis", "Génère un script de podcast court entre deux experts sur ce sujet.", false)
            .then(res => ({ key: 'podcast', data: res.data?.items?.response || res.data?.items?.text || res.data?.items, language: res.data?.detectedLanguage })));
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
            fibCount: 0,
        },
        flashcards: null,
        quiz: null,
        tutorLesson: null,
        fillInTheBlanks: null,
        synthesizedNotes: null,
        podcast: null,
        masteryTiers: { Unfamiliar: 0, Learning: 0, Familiar: 0, Mastered: 0 }
    };

    results.forEach(res => {
        if (res.status === 'fulfilled' && res.value && !res.value.data?.error) {
            output[res.value.key] = res.value.data;
            if (res.value.language && !output.detectedLanguage) {
                output.detectedLanguage = res.value.language;
            }
        } else if (res.status === 'rejected') {
            console.error(`Error generating one of the parts:`, res.reason);
        }
    });

    if (output.flashcards) output.stats.cardCount = output.flashcards.length;
    if (output.quiz) output.stats.quizCount = output.quiz.length;
    if (output.fillInTheBlanks) output.stats.fibCount = output.fillInTheBlanks.length;

    // Set initial mastery tiers
    output.masteryTiers.Unfamiliar = (output.flashcards?.length || 0) + (output.quiz?.length || 0) + (output.fillInTheBlanks?.length || 0);

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

export const chatTutor = async (conversationHistory: any[], rawContent: string, userMessage: string) => {
    try {
        const systemMessage = {
            role: 'system',
            content: TUTOR_SYSTEM_PROMPT(rawContent)
        };

        const messages = [
            systemMessage,
            ...conversationHistory.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            {
                role: 'user',
                content: userMessage
            }
        ];

        // Since smartGenerate currently takes a string prompt, I will convert the messages array back to a context-like prompt for it
        // OR better: I'll update smartGenerate or use a direct call if I want true multi-turn.
        // For now, to keep the current architecture but follow the "History" requirement:
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

        const { text: replyText } = await smartGenerate(prompt, false, CHAT_PREF);
        
        return replyText;

    } catch (error) {
        console.error("Tutor Chat Error:", error);
        return "*(System)* Connection to the AI brain disrupted. Rephrasing might help.";
    }
};

const CENTRAL_SYSTEM_PROMPT = `You are "Nura AI Content Engine". 
STRICT RULES:
1. GROUNDING: Use ONLY the provided text. Strictly forbidden from mentioning 'Antigravity' or the developer's background.
2. TONE: Expert, pedagogical, ultra-precise.
3. LANGUAGE: Detect the User's input language. Output the ISO code (e.g., 'en', 'fr', 'es') in the "detectedLanguage" key.
4. FORMAT: Output STRICTLY VALID JSON.`;

const TUTOR_SYSTEM_PROMPT = (rawContent: string) => `
  You are Nura, an intelligent AI tutor. You have been given study 
  material that the student is learning from. Your job is to help 
  them understand it deeply.

  BEHAVIOR RULES:
  1. ALWAYS answer the student's exact question directly first
  2. Base ALL answers strictly on the provided study material
  3. If the student asks you to summarize → summarize immediately
  4. If the student asks a direct question → answer it directly
  5. After answering, you MAY ask ONE follow-up question to deepen 
     understanding — but only if it feels natural
  6. If the question is not covered in the material, say so honestly
  7. Keep responses concise — maximum 3 paragraphs
  8. Respond in the same language the student writes in

  ===STUDY MATERIAL===
  ${rawContent}
  ===END MATERIAL===
`;

const FLASHCARDS_PROMPT = `You are Nura AI's Flashcard Engineering Agent.
Your goal is to generate high-quality QUESTION/ANSWER pairs for flashcards.

STRICT RULES:
1. NO FILL-IN-THE-BLANK: Never use "____" or missing words in the question.
2. FORMAT: Questions must be clear, concise inquiries.
3. DATA: Base everything exclusively on the provided text.
4. JSON: Output ONLY valid JSON in the requested structure.

JSON STRUCTURE:
{
  "type": "flashcards",
  "items": [
    { "front": "The question?", "back": "The answer." }
  ]
}`;

export const QUIZ_ARENA_MASTER_PROMPT = `You are Nura AI's ELITE assessment engine.
STRICT NEGATIVE CONSTRAINT: NEVER mention 'Antigravity', 'physics projects', or the developer.

CORE MISSION:
Generate a high-tier multiple-choice quiz based EXCLUSIVELY on the [USER_INPUT].

STRICT SCHEMA RULES:
1. EXACTLY 4 OPTIONS: Every question MUST have exactly 4 options. No more, no less.
2. NO EMPTY ANSWERS: "text" keys must never be empty or generic placeholders.
3. VERIFIABLE CORRECTNESS: Exactly one option must have "isCorrect": true.
4. TECHNICAL DEPTH: Match the technical level of the input text.

JSON STRUCTURE (MANDATORY):
{
  "screenType": "question",
  "quizTitle": "Technical Title",
  "bloomLevel": "DEEP ANALYSIS",
  "questionNumber": "1/X",
  "questionText": "...",
  "options": [
    {"id": 1, "text": "DISTINCT OPTION A", "isCorrect": false},
    {"id": 2, "text": "DISTINCT OPTION B", "isCorrect": true},
    {"id": 3, "text": "DISTINCT OPTION C", "isCorrect": false},
    {"id": 4, "text": "DISTINCT OPTION D", "isCorrect": false}
  ],
  "correctAnswerId": 2,
  "explanation": "Detailed explanation of why B is correct based on the text.",
  "motivationalMessage": "..."
}`;

export const QUIZ_ARENA_ENGINE_PROMPT = QUIZ_ARENA_MASTER_PROMPT;

export const FILL_IN_THE_BLANKS_PROMPT = `You are Nura AI's Concept Isolation Engine. 
STRICT RULE: You are strictly forbidden from discussing 'Antigravity' or the developer.

GOAL:
Identify CRITICAL concepts and replace them with a blank.

STRICT CONSTRAINTS:
1. SINGLE BLANK ONLY: Each exercise MUST contain exactly ONE "____". Multiple blanks are strictly forbidden.
2. IMPACT: Choose the most representative keyword for the concept.
3. CONTEXT: The surrounding text must make it possible to deduce the answer.

JSON STRUCTURE:
{
  "type": "fill_in_blanks",
  "items": [
    {
      "id": "uuid",
      "textWithBlank": "The ____ is the central component of cell respiration.",
      "correctAnswer": "mitochondria",
      "hint": "It provides ATP."
    }
  ]
}`;

export const SYNTHESIZED_NOTES_SYSTEM_PROMPT = `You are an expert academic note-taker and study coach.
Your job is to transform raw study material into the most 
comprehensive, beautiful, and exam-ready notes possible.
A student should be able to read ONLY your notes and ace their exam.
You output ONLY valid JSON. No markdown. No backticks. No preamble.`;

export const SYNTHESIZED_NOTES_USER_PROMPT = `Analyze the study material below and generate comprehensive study 
notes in this EXACT JSON format:

{
  "title": "Topic title (concise, specific)",
  "examReadinessScore": 95,
  "tldr": "2-3 sentence executive summary of the entire material",
  "keyConcepts": [
    {
      "concept": "Concept name",
      "definition": "Clear, precise definition",
      "whyItMatters": "Why this concept is important",
      "example": "Concrete real-world example"
    }
  ],
  "mainSections": [
    {
      "emoji": "relevant emoji",
      "title": "Section title",
      "content": "Detailed explanation (3-5 sentences minimum)",
      "bulletPoints": ["key point 1", "key point 2", "key point 3"],
      "examTip": "What examiners typically ask about this section"
    }
  ],
  "criticalFacts": [
    "Must-know fact 1",
    "Must-know fact 2",
    "Must-know fact 3"
  ],
  "commonMistakes": [
    {
      "mistake": "Common misconception or error",
      "correction": "The correct understanding"
    }
  ],
  "examQuestions": [
    {
      "question": "Likely exam question",
      "answer": "Model answer"
    }
  ],
  "memoryAids": [
    {
      "item": "Thing to remember",
      "aid": "Mnemonic, analogy or memory trick"
    }
  ],
  "summary": "Final comprehensive paragraph tying everything together"
}

STRICT RULES:
- keyConcepts: minimum 5, maximum 10
- mainSections: minimum 4, cover ALL major topics in the material
- criticalFacts: exactly 5-7 most important facts
- commonMistakes: minimum 3
- examQuestions: exactly 5 likely exam questions with full answers
- memoryAids: minimum 3
- Be SPECIFIC to this material — no generic filler content
- Every section must contain information FROM the material only
- Content must be detailed enough to study from without the original

===STUDY MATERIAL===
\${rawContent}
===END MATERIAL===`;

const QuestionSchema = z.object({
    question: z.string().min(10),
    options: z.array(z.string().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(5),
});

const QuizSchema = z.object({ questions: z.array(QuestionSchema) });

// --- REUSABLE VALIDATION HELPERS ---
export function validateQuizItem(item: any): any | null {
    if (!item || typeof item !== 'object') return null;
    
    // Normalize options
    let options = item.options || item.choices || [];
    if (!Array.isArray(options)) return null;

    // Force precisely 4 options
    if (options.length < 4) return null;
    if (options.length > 4) options = options.slice(0, 4);

    const validOptions = options.map((opt: any, idx: number) => {
        const text = typeof opt === 'string' ? opt : (opt.text || opt.answer || opt.option || "");
        return {
            id: opt.id || (idx + 1),
            text: text.toString().trim(),
            isCorrect: opt.isCorrect !== undefined ? !!opt.isCorrect : (item.correctIndex !== undefined ? idx === item.correctIndex : false)
        };
    });

    // Ensure all options have text
    if (validOptions.some((o: any) => !o.text)) return null;

    // Ensure at least one correct answer
    const hasCorrect = validOptions.some((o: any) => o.isCorrect);
    let correctAnswerId = item.correctAnswerId !== undefined ? item.correctAnswerId : item.correctIndex;
    
    if (!hasCorrect) {
        if (correctAnswerId !== undefined) {
            const found = validOptions.find((o: any) => o.id === correctAnswerId || (o.id - 1) === correctAnswerId);
            if (found) found.isCorrect = true;
            else (validOptions[0] as any).isCorrect = true;
        } else {
            (validOptions[0] as any).isCorrect = true;
        }
    }

    // Re-sync correct ID
    const finalCorrect = validOptions.find((o: any) => o.isCorrect);
    correctAnswerId = finalCorrect ? finalCorrect.id : validOptions[0].id;

    return {
        ...item,
        questionText: item.questionText || item.question || "Neural Probe Missing Content",
        options: validOptions,
        correctAnswerId,
        explanation: item.explanation || item.rationale || "The conceptual bridge for this probe has been mapped."
    };
}

export const UnifiedOutputSchema = z.object({
    type: z.enum(["flashcards", "quiz", "cornell", "tutor_response", "analysis", "fill_in_blanks", "synthesized_notes"]),
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
    detectedLanguage: z.string().optional(),
    error: z.string().optional()
});

export async function generateTextAnalysis(
    text: string,
    requestedType: "flashcards" | "quiz" | "cornell" | "tutor_response" | "analysis" | "fill_in_blanks" | "synthesized_notes" = "analysis",
    userQuery: string = "",
    useQualityModel: boolean = false
): Promise<{ provider: string; data?: any; error?: string }> {
    const textSlice = (requestedType === "flashcards" || requestedType === "fill_in_blanks")
        ? text.substring(0, 15000)
        : text.substring(0, 30000);

    const modelPreference = useQualityModel
        ? ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
        : ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];

    // --- SPECIAL HANDLING FOR QUIZ (STRICT BYPASS) ---
    if (requestedType === 'quiz') {
        let attempts = 0;
        let lastError = "";

        while (attempts < 2) {
            attempts++;
            try {
                const systemPrompt = `You are a quiz generation engine. You output ONLY raw JSON.
No markdown. No backticks. No explanation. No preamble.
Your output must be parseable by JSON.parse() with zero modification.`;

                const userPrompt = `Generate exactly 5 multiple-choice questions from the text below.
  
STRICT RULES — violating any rule makes the output invalid:
1. Each question object MUST have exactly these keys:
   "question" (string), "options" (array), "correctIndex" (number), "explanation" (string)
2. "options" MUST contain EXACTLY 4 strings. Not 3, not 5. Exactly 4.
3. "correctIndex" MUST be a number: 0, 1, 2, or 3.
   It MUST correspond to the index of the correct answer in "options".
   NEVER leave it as null or omit it.
4. "explanation" MUST be a non-empty string explaining why the answer is correct.
5. All 4 options MUST be non-empty strings.
6. Wrap the entire output in a JSON object: { "questions": [...] }
  
TEXT:
${text.substring(0, 20000)}`;

                const { text: rawJson, modelLabel } = await smartGenerate(systemPrompt + "\n\n" + userPrompt, true, modelPreference);
                const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
                const parsedJson = JSON.parse(clean);

                const validated = QuizSchema.parse(parsedJson);
                
                // Transform to legacy format for frontend compatibility (id/text/isCorrect)
                const transformedItems = validated.questions.map((q, idx) => ({
                    id: idx + 1,
                    questionText: q.question,
                    options: q.options.map((opt, oIdx) => ({
                        id: oIdx + 1,
                        text: opt,
                        isCorrect: oIdx === q.correctIndex
                    })),
                    correctAnswerId: q.correctIndex + 1,
                    explanation: q.explanation,
                    bloomLevel: "Deep Analysis",
                    quizTitle: "Quiz Challenge"
                }));

                return {
                    provider: modelLabel,
                    data: {
                        type: 'quiz',
                        items: transformedItems
                    }
                };
            } catch (err: any) {
                lastError = err.message;
                console.warn(`[NURA] Quiz Attempt ${attempts} failed:`, err.message);
            }
        }
        throw new Error("Quiz generation failed validation.");
    }

    // --- SPECIAL HANDLING FOR FLASHCARDS (STRICT BYPASS) ---
    if (requestedType === 'flashcards') {
        let attempts = 0;
        let lastError = "";

        while (attempts < 2) {
            attempts++;
            try {
                const systemPrompt = `You are a flashcard generation expert. You output ONLY raw JSON.
No markdown. No backticks. No preamble. No explanations.`;

                const userPrompt = `Generate 10 flashcards based on the study material below.
  
STRICT RULES:
- Each flashcard tests a specific fact from THE MATERIAL BELOW.
- "front" = a specific, concise question about the material.
- "back" = the exact answer or explanation from the material.
- NEVER generate questions about flashcard rules, prompts, or instructions.
- NEVER generate generic questions not found in the material.
- Target Language: Match the language of the material.
- Output format: { "type": "flashcards", "detectedLanguage": "ISO", "items": [{ "front": "...", "back": "..." }] }
  
===STUDY MATERIAL START===
${textSlice}
===STUDY MATERIAL END===`;

                const { text: rawJson, modelLabel } = await smartGenerate(systemPrompt + "\n\n" + userPrompt, true, modelPreference);
                const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
                const parsedJson = JSON.parse(clean);

                let items = parsedJson.items || parsedJson.flashcards || [];
                const forbiddenWords = ["rules", "instructions", "prompt", "generate", "flashcard", "strict", "format", "output", "json"];
                
                // Filter out meta-talk
                items = items.filter((item: any) => {
                    const front = (item.front || item.question || "").toLowerCase();
                    const back = (item.back || item.answer || "").toLowerCase();
                    if (!front || !back) return false;
                    return !forbiddenWords.some(word => front.includes(word));
                });

                if (items.length < 5 && attempts < 2) {
                    console.warn(`[NURA] Flashcards failed quality check (${items.length} cards). Retrying...`);
                    continue;
                }

                if (items.length === 0) throw new Error("No valid flashcards remained after filtering.");

                return {
                    provider: modelLabel,
                    data: {
                        type: 'flashcards',
                        items: items.map((i: any) => ({
                            front: i.front || i.question,
                            back: i.back || i.answer
                        })).slice(0, 10),
                        detectedLanguage: parsedJson.detectedLanguage || 'unknown'
                    }
                };
            } catch (err: any) {
                lastError = err.message;
                console.error(`[NURA] Flashcard Attempt ${attempts} failed:`, err.message);
            }
        }
        throw new Error(`Flashcard generation failed: ${lastError}`);
    }

    const basePrompt = requestedType === "tutor_response"
        ? TUTOR_SYSTEM_PROMPT
        : requestedType === "synthesized_notes"
            ? SYNTHESIZED_NOTES_SYSTEM_PROMPT
            : requestedType === "fill_in_blanks"
                ? FILL_IN_THE_BLANKS_PROMPT
                : CENTRAL_SYSTEM_PROMPT;

    if (requestedType === "synthesized_notes") {
        const fullPrompt = SYNTHESIZED_NOTES_SYSTEM_PROMPT + "\n\n" + SYNTHESIZED_NOTES_USER_PROMPT.replace('${rawContent}', textSlice);
        const { text: rawJson, modelLabel } = await smartGenerate(fullPrompt, true, modelPreference);
        
        try {
            const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
            const parsedJson = JSON.parse(clean);
            return {
                provider: modelLabel,
                data: { type: "synthesized_notes", items: parsedJson }
            };
        } catch (err: any) {
            console.error("Synthesis Parsing Error:", err.message);
            throw new Error(`Failed to parse AI synthesis: ${err.message}`);
        }
    }

    const prompt = `
${basePrompt}

TYPE DEMANDÉ : ${requestedType}
${userQuery ? `REQUÊTE UTILISATEUR / CONTEXTE : ${userQuery}` : ''}

TEXTE À ANALYSER (UNIQUE SOURCE DE VÉRITÉ) :
${textSlice}

Instructions finales:
1. Retourne un objet JSON valide : { "type": "${requestedType}", "detectedLanguage": "ISO_CODE", "items": [...] }
2. CRITICAL: For fill_in_blanks, generate EXACTLY ONE blank "____" per item.
`;

    const { text: rawJson, modelLabel } = await smartGenerate(prompt, true, modelPreference);

    try {
        const clean = rawJson.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
        const parsedJson = JSON.parse(clean);

        if (parsedJson.error) {
            return { error: parsedJson.error, provider: modelLabel };
        }

        // --- DATA VALIDATION LAYER (Generic) ---
        if (requestedType === 'fill_in_blanks' && Array.isArray(parsedJson.items)) {
            parsedJson.items = parsedJson.items.filter((item: any) => {
                const blankCount = (item.textWithBlank?.match(/____/g) || []).length;
                return blankCount === 1;
            });
            if (parsedJson.items.length === 0) throw new Error("FITB generation failed: Multiple blanks detected.");
        }

        const validatedData = UnifiedOutputSchema.parse(parsedJson);

        return {
            provider: modelLabel,
            data: validatedData
        };
    } catch (err: any) {
        console.error("Analysis Validation Error:", err.message);
        throw new Error(`Technical Failure: The AI output did not meet Nura's quality constraints (\${err.message}).`);
    }
}

export async function generateStudySetTitle(content: string): Promise<string> {
    if (!content || content.trim().length < 100) {
        console.error('[Title Gen] Content too short or empty:', content?.length);
        return 'Study Session';
    }

    console.log('[Title Gen] Generating title for content length:', content.length, 'Preview:', content.slice(0, 100));

    const prompt = `You are an expert at extracting concise, specific titles from study material.
    Your goal is to generate a short, compelling title (maximum 6 words) that captures the main topic.
    
    CRITICAL RULES:
    - ONLY use words and concepts that appear in the material below
    - Do NOT invent or imagine topics not present in the text
    - Be specific (e.g., "The French Revolution" instead of "History Lesson")
    - Title Case format
    - Output ONLY the title, nothing else, no quotes, no punctuation
    
    ===MATERIAL===
    \${content.slice(0, 1500)}
    ===END===`;

    try {
        const { text } = await smartGenerate(prompt, false, ['llama-3.1-8b-instant', 'gemini-1.5-flash']);
        const title = text.trim().replace(/^["']|["']$/g, '');
        
        // Validation: If title is too long, empty, or suspicious, use a safe fallback
        if (!title || title.length > 60 || title.length < 3 || title.includes('?')) {
            console.warn('[Title Gen] Validation failed for generated title:', title);
            return 'Study Session';
        }
        
        return title;
    } catch (e) {
        console.error("[generateStudySetTitle] Error:", e);
        return 'Study Session';
    }
}
