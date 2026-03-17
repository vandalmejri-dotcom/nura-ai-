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
        const result = await generateTextAnalysis(
            text, 
            "fill_in_blanks", 
            "Generate EXACTLY 5 high-quality fill-in-the-blank questions.", 
            false
        );

        const items = result.data?.items || [];
        const finalItems = items.slice(0, 5);

        // Save to DB
        await prisma.studySet.update({
            where: { id: setId },
            data: {
                fillInTheBlanks: finalItems,
                stats: {
                    ...(studySet.stats || {}),
                    fibCount: finalItems.length
                }
            } as any
        });

        return NextResponse.json({
            success: true,
            data: finalItems
        });
    } catch (error: any) {
        console.error("[Generate FIB] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
