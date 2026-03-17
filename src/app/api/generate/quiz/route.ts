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

        // Generate maximum 5 items to stay within 10s limit
        // The 'quiz' type in generateTextAnalysis has built-in strict validation and prompt
        const result = await generateTextAnalysis(
            text, 
            "quiz", 
            "Generate EXACTLY 5 multiple-choice questions for this content.", 
            false
        );

        const quizItems = result.data?.items || result.data?.questions || [];
        const finalQuiz = quizItems.slice(0, 5);

        if (finalQuiz.length === 0) {
            throw new Error("Failed to generate valid quiz questions.");
        }

        // Save to DB
        await prisma.studySet.update({
            where: { id: setId },
            data: {
                quiz: finalQuiz,
                stats: {
                    ...(studySet.stats || {}),
                    quizCount: finalQuiz.length
                }
            } as any
        });

        return NextResponse.json({
            success: true,
            data: finalQuiz
        });
    } catch (error: any) {
        console.error("[Generate Quiz] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
