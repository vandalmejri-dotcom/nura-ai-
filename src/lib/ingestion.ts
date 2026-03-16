import mammoth from 'mammoth'; // Force Rebuild Fix

// Polyfills for pdf-parse (pdf.js) in Node.js environment
if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class { }; }
if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class { }; }
if (typeof global.Path2D === 'undefined') { (global as any).Path2D = class { }; }

const pdfParse = require('pdf-parse');

export async function parsePDF(buffer: Buffer): Promise<string> {
    const MAX_SIZE = 15 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) throw new Error("File exceeds 15MB limit.");

    try {
        console.log("[NURA] PDF Extraction Started (One-Shot)");
        const data = await pdfParse(buffer);
        return data.text || "";
    } catch (err: any) {
        console.error("Erreur d'extraction PDF:", err);
        throw new Error("Failed to parse PDF content. It might be encrypted or malformed.");
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






