// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateStudySet } from '@/lib/llm-service';
import { parsePDF, parseDOCX } from '@/lib/ingestion';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                const body = await req.json();
                const { blobUrl, fileName, options, language } = body;

                send({ type: 'debug', message: `Initializing extraction for ${fileName}...`, progress: 10 });

                if (!blobUrl || !blobUrl.includes('public.blob.vercel-storage.com')) {
                    throw new Error("Storage URL missing or unauthorized");
                }

                const response = await fetch(blobUrl);
                if (!response.ok) throw new Error("Failed to download file from storage.");

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                send({ type: 'debug', message: "File downloaded. Starting text extraction...", progress: 30 });

                let text = '';
                if (fileName.toLowerCase().endsWith('.pdf')) {
                    text = await parsePDF(buffer, (p) => {
                        send({ type: 'debug', message: `Extracting PDF content...`, progress: 30 + (p * 0.2) });
                    });
                } else if (fileName.toLowerCase().endsWith('.docx')) {
                    text = await parseDOCX(buffer);
                } else {
                    text = buffer.toString('utf-8');
                }

                const cleanText = text ? text.replace(/\0/g, '').trim() : '';
                if (cleanText.length < 50) {
                    throw new Error("Extracted text is too short. Is the PDF scanned or empty?");
                }

                send({ 
                    type: 'debug', 
                    message: `Extraction complete (${cleanText.length} chars). Engaging AI Engine...`, 
                    progress: 60 
                });

                const studySetData = await generateStudySet(fileName, cleanText, options, language);
                
                send({ 
                    type: 'result', 
                    success: true, 
                    data: {
                        ...studySetData,
                        id: 'set_' + Date.now(),
                        sourceName: fileName,
                        sourceContent: cleanText,
                        sourceUrl: blobUrl,
                        rawContent: cleanText
                    } 
                });

                controller.close();
            } catch (error: any) {
                console.error("STREAM ERROR:", error);
                send({ type: 'error', error: error.message || "Unknown processing error" });
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
        },
    });
}
