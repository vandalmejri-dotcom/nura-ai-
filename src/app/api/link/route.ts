// src/app/api/link/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateStudySet } from '@/lib/llm-service';
import { fetchYouTubeTranscript } from '@/lib/ingestion';

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
                const { link, text, options, language } = body;

                // 1. YouTube Harvest Trigger
                if (link && (link.includes('youtube.com') || link.includes('youtu.be'))) {
                    send({ type: 'debug', message: "Engaging Sovereign Harvester...", progress: 10 });
                    
                    const transcriptString = await fetchYouTubeTranscript(link);
                    
                    send({ 
                        type: 'debug', 
                        message: `Harvest success (${transcriptString.length} chars). Engaging AI Engine...`, 
                        progress: 40 
                    });

                    const studySet = await generateStudySet('YouTube Session', transcriptString, options, language);
                    
                    send({ 
                        type: 'result', 
                        success: true, 
                        data: studySet 
                    });
                    
                    controller.close();
                    return;
                }

                // 2. Raw Text / Generic Link Handling
                const fileContent = text || `Web link: ${link}`;
                if (!fileContent) {
                    throw new Error('No content available.');
                }

                send({ type: 'debug', message: "Processing provided content...", progress: 20 });
                const studySet = await generateStudySet('Pasted Content', fileContent, options, language);
                
                send({ 
                    type: 'result', 
                    success: true, 
                    data: studySet 
                });

                controller.close();

            } catch (error: any) {
                console.error('Core Engine Failure:', error.message);
                send({ type: 'error', error: error.message || "Failed to process content." });
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
