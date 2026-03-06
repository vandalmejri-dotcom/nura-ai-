/**
 * Nura AI — Smart Multi-Model LLM Service with Quota Management
 *
 * Strategy: Maximise total daily usage by routing requests to the
 *           model with the most remaining capacity first.
 *
 * Gemini daily budgets (free tier, 2025):
 *   Flash-Lite : 15 RPM  | 1,000 RPD  | 250,000 TPM  ← workhorse
 *   2.0 Flash  : 15 RPM  | 200  RPD   | 1,000,000 TPM ← big docs
 *   2.5 Flash  :  10 RPM  | 250  RPD   | 250,000 TPM  ← quality chat
 *   2.5 Pro    :   5 RPM  | 100  RPD   | 250,000 TPM  ← last resort
 *   Ollama     :  ∞       | ∞          | ∞             ← always free
 *
 * Total Gemini capacity: 1,550 requests / day before Ollama kicks in.
 */

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

// ─── Runtime key (hot-swappable from /api/set-key) ───────────────────────────
let currentApiKey = process.env.GEMINI_API_KEY || '';
const setApiKey = (key) => { currentApiKey = key.trim(); };
const getApiKey = () => currentApiKey;

// ─── Model Registry ───────────────────────────────────────────────────────────
const MODELS = [
    {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        rpm: 10,
        rpd: 250,
        tpm: 250_000,
        priority: 1,
    },
    {
        id: 'gemini-2.0-flash-lite',
        label: 'Gemini 2.0 Flash Lite',
        rpm: 15,
        rpd: 1500,
        tpm: 250_000,
        priority: 2,
    },
    {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        rpm: 5,
        rpd: 100,
        tpm: 250_000,
        priority: 3,
    }
];

// ─── Quota Tracker ────────────────────────────────────────────────────────────
class QuotaManager {
    constructor() {
        this.usage = {};
        MODELS.forEach(m => {
            this.usage[m.id] = {
                // Ring-buffer of timestamps (ms) for RPM tracking
                recent: [],
                // Daily count + reset boundary
                dailyCount: 0,
                dayStart: this._todayUTC(),
                // Track permanent 429 / quota-exhausted errors today
                exhaustedToday: false,
            };
        });
    }

    _todayUTC() {
        const now = new Date();
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    }

    _maybeResetDay(modelId) {
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

    _pruneRecent(modelId) {
        const cutoff = Date.now() - 60_000; // last 60 seconds
        this.usage[modelId].recent = this.usage[modelId].recent.filter(t => t > cutoff);
    }

    /**
     * Can we send a request to this model right now?
     */
    canUse(model) {
        this._maybeResetDay(model.id);
        const u = this.usage[model.id];
        if (u.exhaustedToday) return false;
        if (u.dailyCount >= model.rpd) return false;
        this._pruneRecent(model.id);
        if (u.recent.length >= model.rpm) return false;
        return true;
    }

    /**
     * Record a successful request.
     */
    recordSuccess(modelId) {
        const u = this.usage[modelId];
        u.recent.push(Date.now());
        u.dailyCount++;
    }

    /**
     * Mark a model as exhausted for today (quota / 429 errors).
     */
    markExhausted(modelId) {
        this.usage[modelId].exhaustedToday = true;
        console.warn(`⛔ ${modelId} marked exhausted for today.`);
    }

    /**
     * How many seconds until the model has RPM capacity again.
     */
    secondsUntilAvailable(model) {
        this._pruneRecent(model.id);
        const u = this.usage[model.id];
        if (u.recent.length < model.rpm) return 0;
        // Oldest request in the window expires soonest
        const oldest = Math.min(...u.recent);
        return Math.ceil((oldest + 60_000 - Date.now()) / 1000);
    }

    /**
     * Pick the best available model for a given preference list.
     * Returns the model object or null if all are unavailable.
     */
    pickModel(preferenceList) {
        for (const modelId of preferenceList) {
            const model = MODELS.find(m => m.id === modelId);
            if (model && this.canUse(model)) return model;
        }
        return null;
    }

    /**
     * Status snapshot for the /api/status endpoint.
     */
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

const quota = new QuotaManager();

// ─── Preference Orders ────────────────────────────────────────────────────────
// For STUDY SET generation (needs JSON output, benefits from large TPM)
// Priority: most daily budget → best for large docs → quality fallback
const STUDY_SET_PREF = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro'
];

// For CHAT / TUTOR (benefits from better reasoning)
// Priority: most daily budget first, then quality
const CHAT_PREF = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro'
];

// ─── Gemini API Call ──────────────────────────────────────────────────────────
async function callGemini(model, prompt, jsonMode) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Gemini API key configured.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`;

    const body = {
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

        // 429 = quota / rate limit; 403 = key issue
        if (status === 429 || status === 403) {
            quota.markExhausted(model.id);
        }

        throw new Error(`[${model.label}] HTTP ${status}: ${errText.substring(0, 250)}`);
    }

    const data = await res.json();

    if (!data.candidates?.length) {
        throw new Error(`[${model.label}] No candidates returned.`);
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
        throw new Error(`[${model.label}] Blocked by safety filters.`);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`[${model.label}] Empty text in response.`);

    return text;
}

// ─── Ollama Fallback ──────────────────────────────────────────────────────────
async function callOllama(prompt, jsonMode) {
    console.log('🦙 All Gemini models at capacity — using local Ollama llama3…');

    const finalPrompt = jsonMode
        ? prompt + '\n\nCRITICAL: Output ONLY valid minified JSON. No markdown. No backticks. No other text.'
        : prompt;

    const res = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: finalPrompt, stream: false }),
    });

    if (!res.ok) throw new Error('Ollama is not running or returned an error.');
    const data = await res.json();
    return { text: data.response, modelLabel: 'Llama 3 (local)' };
}

// ─── Smart Generate ───────────────────────────────────────────────────────────
/**
 * Selects the best available model, tries it, and cascades to the next
 * if rate-limited or failed. Falls back to Ollama as the final resort.
 *
 * @param {string} prompt
 * @param {boolean} jsonMode — true for study sets, false for chat
 * @param {string[]} preferenceList — ordered list of model IDs to try
 */
async function smartGenerate(prompt, jsonMode, preferenceList) {
    const errors = [];

    // ── Try available Gemini models in preference order ──────────────────
    while (true) {
        const model = quota.pickModel(preferenceList);

        if (!model) {
            // No Gemini model available right now — calculate wait hint
            const waits = MODELS.map(m => ({
                label: m.label,
                secs: quota.secondsUntilAvailable(m),
                rpd: m.rpd,
                dailyRemaining: Math.max(0, m.rpd - quota.usage[m.id].dailyCount),
            }));
            const soonest = waits.filter(w => w.dailyRemaining > 0).sort((a, b) => a.secs - b.secs)[0];
            if (soonest && soonest.secs <= 15) {
                // Worth waiting a moment for the rate window to clear
                const waitMs = soonest.secs * 1000 + 500;
                console.log(`⏳ Waiting ${soonest.secs}s for ${soonest.label} RPM window to clear…`);
                await new Promise(r => setTimeout(r, waitMs));
                continue; // retry
            }
            break; // all exhausted for today → fall through to Ollama
        }

        try {
            console.log(`🤖 [${model.label}] Sending request… (RPD: ${quota.usage[model.id].dailyCount + 1}/${model.rpd})`);
            const text = await callGemini(model, prompt, jsonMode);
            quota.recordSuccess(model.id);
            console.log(`✅ [${model.label}] Success (RPM: ${quota.usage[model.id].recent.length}/${model.rpm}, RPD: ${quota.usage[model.id].dailyCount}/${model.rpd})`);
            return { text, modelLabel: model.label };
        } catch (err) {
            console.warn(`⚠️  [${model.label}] Failed: ${err.message}`);
            errors.push(err.message);
            // If the model is now marked exhausted, loop will skip it next
        }
    }

    // ── Ollama — always free ─────────────────────────────────────────────
    try {
        return await callOllama(prompt, jsonMode);
    } catch (err) {
        errors.push(`Ollama: ${err.message}`);
    }

    throw new Error('All AI providers are unavailable.\n' + errors.join('\n'));
}

// ─── Provider Status ──────────────────────────────────────────────────────────
async function checkProviderStatus() {
    // Gemini — read from quota tracker (no extra API calls wasted)
    const geminiModels = quota.getStatus();
    const bestGemini = geminiModels.find(m => m.available);

    // Ollama — quick ping
    let ollamaAvailable = false;
    try {
        const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        ollamaAvailable = r.ok;
    } catch (_) { /* not running */ }

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

// ─── Public API: Study Set Generation ────────────────────────────────────────
const generateStudySet = async (fileName, fileContent, options = [], language = 'en') => {
    // Determine language string
    const langMap = { en: 'US English', es: 'Spanish', fr: 'French', de: 'German', zh: 'Chinese' };
    const langStr = langMap[language] || 'English';

    // Default to at least flashcards and quiz if options array is empty/invalid
    let hasFlashcards = Array.isArray(options) && options.includes('flashcards');
    let hasQuiz = Array.isArray(options) && options.includes('quiz');
    let hasNotes = Array.isArray(options) && options.includes('notes');
    let hasPodcast = Array.isArray(options) && options.includes('podcast');
    let hasTutorLesson = Array.isArray(options) && options.includes('tutorlesson');
    let hasWrittenTests = Array.isArray(options) && options.includes('writtentests');
    let hasFillInTheBlanks = Array.isArray(options) && options.includes('fillintheblanks');

    if (!Array.isArray(options) || options.length === 0) {
        hasFlashcards = true;
        hasQuiz = true;
    }

    let pFormat = '{';
    if (hasFlashcards) pFormat += '\n  "flashcards": [{"id": 0, "front": "Question/Term", "back": "Detailed explanation"}],';
    if (hasQuiz) pFormat += '\n  "quiz": [{"id": "q_0", "question": "Deep multiple choice?", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}],';
    if (hasNotes) pFormat += '\n  "notes": "# Cornell Notes Title\\n\\n## Cues\\n- Cue 1\\n\\n## Notes\\nDetailed notes with markdown formatting and bullet points.",';
    if (hasPodcast) pFormat += '\n  "podcast": "**Host 1:** Welcome to the podcast!\\n\\n**Host 2:** Thanks for having me, today we discuss...",';
    if (hasTutorLesson) pFormat += '\n  "tutorLesson": "## Welcome to your Lesson\\nHere is a step by step breakdown of the core concepts...",';
    if (hasWrittenTests) pFormat += '\n  "writtenTests": "## Short Answer Test\\n**Q1:** What is...?\\n\\n**Answer:** It is...",';
    if (hasFillInTheBlanks) pFormat += '\n  "fillInTheBlanks": "## Active Recall\\n1. The powerhouse of the cell is the _____. (Answer: mitochondria)",';
    pFormat += '\n  "stats": {"cardCount": 10, "quizCount": 5}\n}';

    const prompt = `You are an expert, highly intelligent teacher. Extract the core knowledge from the following document and generate a comprehensive study set in ${langStr}.

Document: ${fileName}

Content:
${fileContent.substring(0, 20000)}

CRITICAL FORMATTING INSTRUCTION: You must NEVER use LaTeX formatting or math-rendering delimiters (such as $, $$, \\[, \\], or backslash commands like \\frac) for any mathematical, scientific, or general content. Write all equations and math strictly in plain text and standard keyboard symbols so it is readable without a renderer (e.g., a/b, x^2, sqrt(x), +, -, *, /, =, <, >). This applies strictly to all flashcards, quizzes, multiple-choice options, and fill-in-the-blanks.

Based on the user's request, you must include the following sections if requested:
${hasFlashcards ? '- Flashcards: High quality, challenging, direct.' : ''}
${hasQuiz ? '- Quiz: Deep multiple choice questions with 4 options and 1 exact correct answer.' : ''}
${hasNotes ? '- Notes: High quality Cornell formatted study notes using Markdown (## headings, bold text, bullet points).' : ''}
${hasPodcast ? '- Podcast: A fun, conversational, dialogue-driven podcast script between two hosts discussing the material.' : ''}
${hasTutorLesson ? '- Tutor Lesson: A structured, step-by-step reading lesson breaking down the concepts natively.' : ''}
${hasWrittenTests ? '- Written Tests: Short answer questions and their detailed answers.' : ''}
${hasFillInTheBlanks ? '- Fill in the Blanks: Sentences with critical missing words (marked with ____) and the answer key.' : ''}

Output ONLY a strict raw JSON object with this exact structure (no markdown wrapper, no backticks outside strings):
${pFormat}
`;

    const { text: raw, modelLabel } = await smartGenerate(prompt, true, STUDY_SET_PREF);

    try {
        const clean = raw.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
        const parsed = JSON.parse(clean);
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
        console.error('❌ JSON parse failed. Raw response:', raw.substring(0, 400));
        throw new Error('AI responded but output could not be parsed as a study set.');
    }
};

// ─── Public API: Chat Tutor ───────────────────────────────────────────────────
const chatTutor = async (fileName, documentContent, userMessage) => {
    const prompt = `You are a brilliant, empathetic AI Mentor inside "Nura AI" — the greatest teacher in the world.
You guide true understanding, use Socratic questioning, and explain with stunning clarity.

Document: "${fileName}"
--- START ---
${documentContent.substring(0, 28000)}
--- END ---

Student asks: "${userMessage}"

Rules:
1. Answer based STRICTLY on the document above.
2. Use markdown (bold, bullets, headings) for beautiful formatting.
3. Do NOT output JSON — respond in natural, readable text.
4. Be warm, smart, and precise.
5. CRITICAL: NEVER use LaTeX formatting or math-rendering delimiters (such as $, $$, \\[, \\], or \\frac). Write all math strictly in plain text (e.g., a/b, x^2, sqrt(x)).`;

    // Chat uses text mode (NOT JSON)
    const { text, modelLabel } = await smartGenerate(prompt, false, CHAT_PREF);

    const label = modelLabel.toLowerCase().includes('llama')
        ? `*(🦙 Powered by ${modelLabel})*\n\n`
        : `*(✨ Powered by ${modelLabel})*\n\n`;

    return label + text;
};

module.exports = {
    generateStudySet,
    chatTutor,
    setApiKey,
    getApiKey,
    checkProviderStatus,
    quota, // exported for routes to expose status
};
