import { NextResponse } from 'next/server';
import { generateTextAnalysis } from '@/lib/llm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: Request) {
    try {
        const { setId, language = 'en' } = await req.json();

        if (!setId) {
            return NextResponse.json({ error: "Missing setId." }, { status: 400 });
        }

        const { prisma } = await import('@/lib/prisma');
        const studySet = await prisma.studySet.findUnique({
            where: { id: setId }
        }) as any;

        if (!studySet || !studySet.rawContent) {
            return NextResponse.json({ error: "Study set or content not found." }, { status: 404 });
        }

        const text = studySet.rawContent;

        // Optimized prompt for high-quality, high-speed flashcard generation
        const prompt = `
            Task: Generate EXACTLY 10 high-quality flashcards for this content.
            Target Language: ${language}
            
            RULES:
            - Generate exactly 10 flashcards.
            - Each card must have a "front" (question) and "back" (answer).
            - Questions must be specific and test real conceptual understanding.
            - Answers must be concise (1-3 sentences maximum).
            - NEVER include "___" or "fill in the blank" formats.
            - NEVER generate duplicate questions.
            - Use professional, educational tone.
            
            OUTPUT FORMAT: ONLY valid JSON as:
            { "flashcards": [{ "front": "...", "back": "..." }] }
        `;

        const result = await generateTextAnalysis(
            text, 
            "flashcards", 
            `Provide precisely 10 flashcards for this content. Every card must have a "front" and "back". Target language: ${language}.`, 
            false
        );

        // result.data is already parsed by llm-service.ts
        const data = result.data || {};
        const items = data.items || data.flashcards || data.cards || (Array.isArray(data) ? data : []);

        console.log('[Flashcards] Raw content length:', text?.length);
        console.log('[Flashcards] Items count from LLM:', items.length);

        // Filter valid cards
        let finalCards = items
            .filter((c: any) => c && (c.front || c.question) && (c.back || c.answer))
            .map((c: any) => ({
                front: c.front || c.question,
                back: c.back || c.answer
            }))
            .filter((c: any) => !c.front.includes('___'))
            .slice(0, 10);

        console.log('[Flashcards] Validated cards count:', finalCards.length);

        if (finalCards.length === 0) {
            return NextResponse.json(
                { error: 'Failed to generate valid flashcards. The AI response was empty or malformed.' },
                { status: 500 }
            );
        }

        // Save to DB
        await prisma.studySet.update({
            where: { id: setId },
            data: {
                flashcards: finalCards,
                stats: {
                    ...(studySet.stats as any || {}),
                    cardCount: finalCards.length
                }
            } as any
        });

        return NextResponse.json({
            success: true,
            data: finalCards
        });
    } catch (error: any) {
        console.error("[Generate Flashcards] Fatal Error:", error);
        return NextResponse.json({ error: error.message || "Internal generation failure." }, { status: 500 });
    }
}
