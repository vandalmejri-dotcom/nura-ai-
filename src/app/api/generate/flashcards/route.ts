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

        const rawResponse = JSON.stringify(result.data); // result.data is already an object from llm-service
        console.log('[Flashcards] rawContent length:', text?.length);
        console.log('[Flashcards] LLM raw response:', rawResponse);

        let parsedCards = [];
        try {
            // Strip markdown code fences if present
            const cleaned = rawResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            
            const parsed = JSON.parse(cleaned);
            
            // Handle both { flashcards: [...] } and direct array
            parsedCards = Array.isArray(parsed) 
                ? parsed 
                : (parsed.flashcards ?? parsed.items ?? parsed.cards ?? []);
            
            // Filter out any invalid cards
            parsedCards = parsedCards.filter(
                (card: any) => card && card.front && card.back && 
                        typeof card.front === 'string' && 
                        typeof card.back === 'string' &&
                        !card.front.includes('___')
            );
            
            console.log('[Flashcards] Valid cards after filter:', parsedCards.length);
        } catch (e) {
            console.error('[Flashcards] JSON parse failed:', e);
            console.error('[Flashcards] Raw response was:', rawResponse);
        }

        if (parsedCards.length === 0) {
            return NextResponse.json(
                { error: 'Failed to generate valid flashcards. Please try again.' },
                { status: 500 }
            );
        }

        const finalCards = parsedCards.slice(0, 10);

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
