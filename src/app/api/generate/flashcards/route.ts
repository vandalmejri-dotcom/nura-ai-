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

        const rawContent = studySet.rawContent;

        if (!rawContent || rawContent.length < 100) {
            return NextResponse.json(
                { error: 'No study content found. Please resubmit your source.' },
                { status: 422 }
            );
        }

        console.log('[Flashcards] Content preview:', rawContent.slice(0, 200));

        const text = rawContent;

        const result = await generateTextAnalysis(
            text, 
            "flashcards", 
            "", 
            false
        );

        if (result.error) {
            console.error('[Flashcards] AI Service Error:', result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        const finalCards = result.data?.items || [];

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
