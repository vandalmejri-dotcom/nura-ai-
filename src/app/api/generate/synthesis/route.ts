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

        const result = await generateTextAnalysis(
            text,
            "synthesized_notes",
            "Generate high-quality synthesized study notes.",
            true // Use quality model for synthesis
        );

        const synthesisData = result.data?.items || "";
        const storageData = typeof synthesisData === 'object' ? JSON.stringify(synthesisData) : synthesisData;

        // Save to DB
        await prisma.studySet.update({
            where: { id: setId },
            data: {
                synthesizedNotes: storageData
            } as any
        });

        return NextResponse.json({
            success: true,
            data: synthesisData
        });
    } catch (error: any) {
        console.error("[Generate Synthesis] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
