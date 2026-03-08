// @ts-ignore
import mammoth from 'mammoth';
import { YoutubeTranscript } from 'youtube-transcript';

// Polyfills for pdf-parse (pdf.js) in Node.js environment
if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class { }; }
if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class { }; }
if (typeof global.Path2D === 'undefined') { (global as any).Path2D = class { }; }

const pdfParse = require('pdf-parse');

export async function parsePDF(buffer: Buffer): Promise<string> {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_SIZE) {
        throw new Error("File exceeds 10MB limit.");
    }

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("pdf-parse extraction timed out after 30 seconds")), 30000);
        });

        // @ts-ignore
        const data = await Promise.race([
            pdfParse(buffer),
            timeoutPromise
        ]);

        return data.text || "";
    } catch (err: any) {
        console.error("Erreur d'extraction PDF:", err);
        throw new Error(err.message || "Failed to parse PDF");
    }
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
    try {
        // Try youtube-transcript package first
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        if (transcript && transcript.length > 0) {
            return transcript.map((t: any) => {
                const minutes = Math.floor((t.offset || 0) / 1000 / 60);
                const seconds = Math.floor(((t.offset || 0) / 1000) % 60);
                const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
                return `${timestamp} ${t.text}`;
            }).join('\n');
        }
        throw new Error("youtube-transcript returned empty.");
    } catch (error: any) {
        console.warn('YouTube Fetch Primary Error:', error.message);

        // Bulletproof Native Fallback: Extract caption tracks from YouTube HTML directly
        try {
            console.log("Using native YouTube HTML fallback extractor...");
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();
            const match = html.match(/"captionTracks":\s*(\[.*?\])/);

            if (match && match[1]) {
                const tracks = JSON.parse(match[1]);
                // Prioritize French, English, or whatever is first
                const track = tracks.find((t: any) => t.languageCode === 'fr')
                    || tracks.find((t: any) => t.languageCode === 'en')
                    || tracks[0];

                if (track && track.baseUrl) {
                    const xmlRes = await fetch(track.baseUrl);
                    const xml = await xmlRes.text();

                    // Simple Regex XML parser for fast native Node parsing without heavy DOM dependencies
                    const textNodes = [...xml.matchAll(/<text[^>]*start="([^"]*)"[^>]*>([^<]*)<\/text>/g)];
                    if (textNodes.length > 0) {
                        return textNodes.map(m => {
                            const start = parseFloat(m[1] || '0');
                            const text = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                            const minutes = Math.floor(start / 60);
                            const seconds = Math.floor(start % 60);
                            return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}] ${text}`;
                        }).join('\n');
                    }
                }
            }
        } catch (fallbackError) {
            console.error('YouTube Native Fallback Error:', fallbackError);
        }

        throw new Error(error.message || 'Could not retrieve transcript from YouTube. The video might not have any captions available.');
    }
}
