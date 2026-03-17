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
            prompt, 
            false // Use faster model for cards to meet 10s limit
        );

        const flashcards = result.data?.flashcards || result.data?.items || [];
        const finalCards = flashcards.slice(0, 10);

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
        console.error("[Generate Flashcards] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
