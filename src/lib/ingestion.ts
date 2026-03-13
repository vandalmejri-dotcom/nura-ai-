import mammoth from 'mammoth'; // Force Rebuild Fix

// Polyfills for pdf-parse (pdf.js) in Node.js environment
if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class { }; }
if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class { }; }
if (typeof global.Path2D === 'undefined') { (global as any).Path2D = class { }; }

const pdfParse = require('pdf-parse');

export async function parsePDF(buffer: Buffer, onProgress?: (p: number) => void): Promise<string> {
    const MAX_SIZE = 15 * 1024 * 1024; // Increased to 15MB
    if (buffer.length > MAX_SIZE) {
        throw new Error("File exceeds 15MB limit.");
    }

    try {
        console.log("[NURA] PDF Extraction Started...");
        if (onProgress) onProgress(10); // Start

        // Using pdf-parse with a custom pagerender to track progress
        let pagesProcessed = 0;
        const data = await pdfParse(buffer, {
            pagerender: (pageData: any) => {
                pagesProcessed++;
                return pageData.getTextContent().then((textContent: any) => {
                    return textContent.items.map((i: any) => i.str).join(' ');
                });
            }
        });

        if (onProgress) onProgress(100);
        return data.text || "";
    } catch (err: any) {
        console.error("Erreur d'extraction PDF:", err);
        throw new Error(err.message || "Failed to parse PDF content. It might be encrypted or malformed.");
    }
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

/**
 * Sanitizes and extracts the 11-character YouTube video ID
 */
export function extractYouTubeID(url: string): string | null {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return (match && match[1]) ? match[1] : null;
}

/**
 * Nura Harvester Sovereign Piped-Proxy Edition
 * Bypasses direct YouTube blocks by routing through the Piped API proxy network.
 * Implements robust VTT/XML cleaning for perfect text extraction.
 */
/**
 * Nura Sovereign Scraper (v2.0)
 * Bypasses Piped/Proxies by directly harvesting and parsing the YouTube watch page.
 * Uses the internal ytInitialPlayerResponse payload and fetches transcripts 
 * in JSON format (json3) for maximum precision.
 */
export async function fetchYouTubeTranscript(urlOrId: string): Promise<string> {
    const videoId = extractYouTubeID(urlOrId) || urlOrId;
    if (!videoId || videoId.length !== 11) throw new Error("NURA_INVALID_VIDEO_ID");

    const startTime = Date.now();
    
    // STRATEGY: Piped Proxies are currently more stable than direct scraping for transcripts
    console.log(`[NURA] Engaging Piped Harvester (Priority) for: ${videoId}`);

    try {
        return await fetchYouTubeTranscriptPiped(videoId);
    } catch (err: any) {
        console.warn(`[NURA] Piped Harvester failed (${err.message}). Attempting Sovereign Scraper fallback...`);
        
        try {
            return await fetchYouTubeTranscriptDirect(videoId);
        } catch (directErr: any) {
            console.error(`[NURA] All automated harvesters exhausted for ${videoId}`);
            throw new Error(`NURA_BLOCKADE: YouTube is aggressively blocking automated requests. 💡 PRO TIP: Go back, select 'Raw Text', and paste the transcript there for instant results!`);
        }
    }
}

/**
 * Sovereign Direct Scraper - Secondary Fallback
 * Directly harvests from the watch page using a mobile identity + Cookie Handshake.
 */
async function fetchYouTubeTranscriptDirect(videoId: string): Promise<string> {
    const startTime = Date.now();
    
    // Step 1: Cookie Handshake & Initial Seed
    // First we fetch the base page to get cookies and session tokens
    const handshake = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
        }
    });
    
    const cookies = handshake.headers.get('set-cookie') || '';
    const html = await handshake.text();

    // Step 2: Extract ytInitialPlayerResponse JSON
    let playerResponsePattern = 'var ytInitialPlayerResponse = ';
    let startIdx = html.indexOf(playerResponsePattern);
    
    if (startIdx === -1) {
        playerResponsePattern = 'ytInitialPlayerResponse = ';
        startIdx = html.indexOf(playerResponsePattern);
    }
    
    if (startIdx === -1) {
        playerResponsePattern = 'window["ytInitialPlayerResponse"] = ';
        startIdx = html.indexOf(playerResponsePattern);
    }
    
    if (startIdx === -1) throw new Error("TARGET_NOT_FOUND");

    const jsonStart = startIdx + playerResponsePattern.length;
    let braceCount = 0;
    let jsonEnd = -1;

    for (let i = jsonStart; i < html.length; i++) {
        if (html[i] === '{') braceCount++;
        else if (html[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
            }
        }
    }

    if (jsonEnd === -1) throw new Error("MALFORMED_PAYLOAD");
    let rawJson = html.substring(jsonStart, jsonEnd).trim();
    if (rawJson.endsWith(';')) rawJson = rawJson.slice(0, -1);
    
    const playerResponse = JSON.parse(rawJson);

    // Step 3: Locate Caption Tracks
    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
        if (playerResponse.playabilityStatus?.status === 'UNPLAYABLE') throw new Error("VIDEO_BLOCKED");
        throw new Error("NO_SUBTITLES");
    }

    const enTrack = 
        tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ||
        tracks.find((t: any) => t.languageCode === 'en') ||
        tracks[0];

    // Step 4: Fetch actual content with Cookies
    const transcriptUrl = enTrack.baseUrl.includes('?') ? `${enTrack.baseUrl}&fmt=json3` : `${enTrack.baseUrl}?fmt=json3`;
            
    const subRes = await fetch(transcriptUrl, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
            'Cookie': cookies
        }
    });
    
    if (!subRes.ok) throw new Error(`TRANSCRIPT_HTTP_${subRes.status}`);

    const subData = await subRes.json();
    if (!subData.events) throw new Error("EMPTY_JSON");

    const fullText = subData.events
        .filter((entry: any) => entry.segs)
        .map((entry: any) => entry.segs.map((s: any) => s.utf8).join(''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

    if (fullText.length < 100) throw new Error("INSUFFICIENT_CONTENT");
    return fullText;
}

/**
 * Legacy Fallback using Piped APIs
 */
async function fetchYouTubeTranscriptPiped(videoId: string): Promise<string> {
    const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi.leptons.xyz',
        'https://pipedapi.moomoo.me',
        'https://pipedapi.drgns.space',
        'https://api.piped.privacydev.net',
        'https://pipedapi.adminforge.de',
        'https://piped-api.lunar.icu',
        'https://pipedapi.rivo.pw',
        'https://pipedapi.mha.fi',
        'https://pipedapi.tokyo.projectsegfau.lt'
    ];

    let streamData: any = null;
    for (const instance of pipedInstances) {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, { 
                signal: AbortSignal.timeout(6000),
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.subtitles?.length > 0) {
                    streamData = data;
                    break;
                }
            }
        } catch (e) { continue; }
    }

    if (!streamData) throw new Error("ALL_WORKAROUNDS_EXHAUSTED");

    const enTrack = streamData.subtitles.find((s: any) => s.code.startsWith('en')) || streamData.subtitles[0];
    const rawRes = await fetch(enTrack.url);
    const rawContent = await rawRes.text();

    return rawContent
        .replace(/WEBVTT/g, '')
        .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*?\n/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{2,}/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
}

