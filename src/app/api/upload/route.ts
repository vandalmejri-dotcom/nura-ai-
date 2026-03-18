// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parsePDF, parseDOCX } from '@/lib/ingestion';
import { generateStudySetTitle } from '@/lib/llm-service';

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

                const processingTask = (async () => {
                    send({ type: 'debug', message: "Received", progress: 10 });

                    if (!blobUrl || !blobUrl.includes('public.blob.vercel-storage.com')) {
                        throw new Error("Storage URL missing or unauthorized");
                    }

                    const response = await fetch(blobUrl);
                    if (!response.ok) throw new Error("Failed to download file from storage.");

                    const buffer = Buffer.from(await response.arrayBuffer());
                    send({ type: 'debug', message: "Extracting", progress: 50 });

                    let text = '';
                    if (fileName.toLowerCase().endsWith('.pdf')) {
                        text = await parsePDF(buffer);
                    } else if (fileName.toLowerCase().endsWith('.docx')) {
                        text = await parseDOCX(buffer);
                    } else {
                        text = buffer.toString('utf-8');
                    }

                    const cleanText = text ? text.replace(/\0/g, '').trim() : '';
                    if (cleanText.length < 50) {
                        throw new Error("Extracted text is too short or empty.");
                    }

                    // --- NEW: LAZY GENERATION ARCHITECTURE ---
                    const generatedTitle = await generateStudySetTitle(cleanText);
                    const words = cleanText.split(/\s+/).filter(w => w.length > 4);
                    
                    const finalData: any = {
                        id: 'set_' + Date.now(),
                        title: generatedTitle,
                        sourceName: fileName,
                        generatedBy: 'Nura AI (Lazy)',
                        sourceContent: cleanText,
                        sourceUrl: blobUrl,
                        rawContent: cleanText,
                        rawContentType: 'file',
                        status: 'ready',
                        stats: {
                            wordCount: words.length,
                            characterCount: cleanText.length,
                            cardCount: 0,
                            quizCount: 0,
                            fibCount: 0,
                        }
                    };

                    // Persistence
                    try {
                        const { prisma } = await import('@/lib/prisma');
                        const user = await prisma.user.upsert({
                            where: { email: 'system@nura.ai' },
                            update: {},
                            create: { email: 'system@nura.ai', name: 'Nura System User' }
                        });

                        const dbSet = await prisma.studySet.create({
                            data: {
                                title: finalData.title || fileName,
                                userId: user.id,
                                rawContent: cleanText,
                                rawContentType: 'file',
                                status: 'ready',
                                metadata: { sourceUrl: blobUrl, fileName }
                            }
                        });
                        finalData.id = dbSet.id;
                    } catch (e: any) {
                        console.warn("[NURA] Upload Prisma persistence failed:", e.message);
                    }

                    send({ 
                        type: 'result', 
                        success: true, 
                        progress: 100,
                        data: finalData
                    });
                })();

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("TIMEOUT")), 9000) // Shorter timeout for Vercel
                );

                await Promise.race([processingTask, timeoutPromise]);
                controller.close();

            } catch (error: any) {
                console.error("UPLOAD_ERROR:", error.message);
                const isTimeout = error.message === "TIMEOUT";
                send({ 
                    type: 'error', 
                    error: isTimeout ? "Extraction timed out or was blocked by the source." : (error.message || "Processing failed")
                });
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
