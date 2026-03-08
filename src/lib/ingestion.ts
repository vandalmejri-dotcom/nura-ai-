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
        // Option 1: Using YoutubeTranscript package directly
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        if (!transcript || transcript.length === 0) {
            throw new Error("No transcript returned.");
        }

        return transcript.map((t: any) => {
            const minutes = Math.floor((t.offset || 0) / 1000 / 60);
            const seconds = Math.floor(((t.offset || 0) / 1000) % 60);
            const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
            return `${timestamp} ${t.text}`;
        }).join('\n');
    } catch (error: any) {
        console.error('YouTube Fetch Error (youtube-transcript):', error.message);

        // Option 2: Fallback to official API or external API if configured
        try {
            const apiKey = process.env.TRANSCRIPT_API_KEY;
            if (apiKey) {
                const res = await fetch(`https://transcriptapi.com/api/v1/youtube?url=${encodeURIComponent(url)}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.transcript) {
                        if (Array.isArray(data.transcript)) {
                            return data.transcript.map((t: any) => {
                                const minutes = Math.floor((t.offset || 0) / 1000 / 60);
                                const seconds = Math.floor(((t.offset || 0) / 1000) % 60);
                                const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
                                return `${timestamp} ${t.text}`;
                            }).join('\n');
                        }
                        return data.transcript;
                    }
                }
            }
        } catch (fallbackError) {
            console.error('YouTube Fallback Error:', fallbackError);
        }

        throw new Error(error.message || 'Could not retrieve transcript perfectly from YouTube.');
    }
}
