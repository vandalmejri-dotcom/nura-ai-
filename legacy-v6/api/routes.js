const express = require('express');
const multer = require('multer');
const { generateStudySet, chatTutor, setApiKey, checkProviderStatus } = require('./llm-service');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { YoutubeTranscript } = require('youtube-transcript');

const router = express.Router();

// Simple in-memory document store (keeps uploaded file content for tutor context)
const documentStore = {};

// Multer: store files in memory, 50 MB max
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── GET /api/status ──────────────────────────────────────────────────────
// Check which AI providers are currently reachable
router.get('/status', async (req, res) => {
    try {
        const status = await checkProviderStatus();
        res.json({ success: true, ...status });
    } catch (err) {
        res.json({ success: false, gemini: { available: false }, ollama: { available: false } });
    }
});

// ─── POST /api/set-key ────────────────────────────────────────────────────
// Hot-swap the Gemini API key at runtime (no server restart needed)
router.post('/set-key', (req, res) => {
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.trim().length < 10) {
        return res.status(400).json({ error: 'Invalid API key provided.' });
    }
    setApiKey(key.trim());
    res.json({ success: true, message: 'API key updated. Retrying with new key…' });
});

// ─── POST /api/link ───────────────────────────────────────────────────────
router.post('/link', async (req, res) => {
    try {
        const { link, text, options, language } = req.body;
        let fileContent = '';
        let fileName = 'Pasted Content';

        if (text) {
            fileContent = text;
        } else if (link) {
            if (link.includes('youtube.com') || link.includes('youtu.be')) {
                try {
                    const transcript = await YoutubeTranscript.fetchTranscript(link);
                    fileContent = transcript.map(t => t.text).join(' ');
                    fileName = 'YouTube Video';
                    if (!fileContent || fileContent.trim() === '') {
                        return res.status(400).json({ error: 'No subtitles/transcript found for this YouTube video.' });
                    }
                } catch (ytErr) {
                    return res.status(400).json({ error: 'Failed to retrieve YouTube transcript. The video might not have captions enabled or is restricted.' });
                }
            } else {
                fileContent = `Please process this link if possible: ${link}`;
                fileName = 'Web Link';
            }
        }

        if (!fileContent) {
            return res.status(400).json({ error: 'No content or link provided.' });
        }

        documentStore[fileName] = fileContent;
        const studySet = await generateStudySet(fileName, fileContent, options, language);
        studySet.sourceContent = fileContent; // Send the clean extracted text to the frontend
        res.json({ success: true, data: studySet });
    } catch (error) {
        console.error('❌ Link Generation Error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to generate study set from link/text.' });
    }
});

// ─── POST /api/upload ─────────────────────────────────────────────────────
// Upload a file → generate study set via AI
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded.' });
        }

        let fileContent = '';
        const fileName = req.file.originalname;

        if (req.file.mimetype === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            const pdfData = await pdfParse(req.file.buffer);
            fileContent = pdfData.text;
        } else if (fileName.toLowerCase().endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            fileContent = result.value;
        } else {
            fileContent = req.file.buffer.toString('utf-8');
        }

        // Parse options from FormData string
        let options = [];
        let language = 'en';
        if (req.body.options) {
            try { options = JSON.parse(req.body.options); } catch (e) { }
        }
        if (req.body.language) language = req.body.language;

        // Keep content in memory for tutor follow-ups
        documentStore[fileName] = fileContent;

        const studySet = await generateStudySet(fileName, fileContent, options, language);
        studySet.sourceContent = fileContent; // Send the beautifully parsed text to frontend

        res.json({ success: true, data: studySet });
    } catch (error) {
        console.error('❌ Upload/Generation Error:', error.message);

        // Tell the frontend whether this looks like an API key issue
        const isKeyError =
            error.message.toLowerCase().includes('api key') ||
            error.message.toLowerCase().includes('401') ||
            error.message.toLowerCase().includes('403') ||
            error.message.toLowerCase().includes('quota');

        res.status(500).json({
            error: error.message || 'Failed to generate study set.',
            isKeyError,
        });
    }
});

// ─── POST /api/chat ───────────────────────────────────────────────────────
// AI Tutor chat endpoint
router.post('/chat', async (req, res) => {
    try {
        const { context, message } = req.body;

        if (!context || !message) {
            return res.status(400).json({ error: 'Missing context or message in request.' });
        }

        const documentContent =
            documentStore[context] ||
            'No document content available (it may have been cleared when the server restarted).';

        const reply = await chatTutor(context, documentContent, message);

        res.json({ success: true, reply });
    } catch (error) {
        console.error('❌ Chat Error:', error.message);

        const isKeyError =
            error.message.toLowerCase().includes('api key') ||
            error.message.toLowerCase().includes('401') ||
            error.message.toLowerCase().includes('403') ||
            error.message.toLowerCase().includes('quota');

        res.status(500).json({
            error: error.message || 'Failed to generate tutor response.',
            isKeyError,
        });
    }
});

module.exports = router;
