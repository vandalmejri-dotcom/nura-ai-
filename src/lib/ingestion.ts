// @ts-ignore
import mammoth from 'mammoth';
import { YoutubeTranscript } from 'youtube-transcript';

// Polyfills for pdf-parse (pdf.js) in Node.js environment
if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class { }; }
if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class { }; }
if (typeof global.Path2D === 'undefined') { (global as any).Path2D = class { }; }

const pdfParse = require('pdf-parse');

export async function parsePDF(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        if (!transcript || transcript.length === 0) {
            throw new Error('No transcript available for this video.');
        }

        // Format with timestamps for "Deep Insights"
        return transcript.map(t => {
            const minutes = Math.floor(t.offset / 1000 / 60);
            const seconds = Math.floor((t.offset / 1000) % 60);
            const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
            return `${timestamp} ${t.text}`;
        }).join('\n');
    } catch (error: any) {
        console.error('YouTube Fetch Error:', error.message);
        if (error.message.includes('Too Many Requests') || error.message.includes('429')) {
            throw new Error('YouTube is temporarily blocking requests. Try a raw text paste or different URL.');
        }
        throw new Error('Could not retrieve transcript. Ensure the video is public and has captions enabled.');
    }
}
