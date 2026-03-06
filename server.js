const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ── .env loader (Windows CRLF safe) ──────────────────────────────────────
// The standard split('\n') on Windows keeps '\r' at the end of each value,
// which silently corrupts API keys. We strip '\r' explicitly.
if (fs.existsSync('.env')) {
    const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
    envLines.forEach(line => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).replace(/\r/g, '').trim();
        if (key && val && !process.env[key]) {
            process.env[key] = val;
        }
    });
    console.log('✅ .env loaded');
}

const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve all frontend files (HTML, CSS, JS) from project root
app.use(express.static(path.join(__dirname)));

// Mount API routes
app.use('/api', apiRoutes);

// Catch-all: send dashboard for any unknown route (Express 5 compatible)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Nura AI Server running at http://localhost:${PORT}`);
    console.log(`   Dashboard → http://localhost:${PORT}/dashboard.html`);
    console.log(`   Gemini key present: ${!!process.env.GEMINI_API_KEY}`);
    console.log('');
});
