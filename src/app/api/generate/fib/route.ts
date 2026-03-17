import { NextResponse } from 'next/server';
import { generateTextAnalysis } from '@/lib/llm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: Request) {
    try {
        const { text, language = 'en' } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "No content provided." }, { status: 400 });
        }

        // Generate maximum 5 items
        const result = await generateTextAnalysis(
            text, 
            "fill_in_blanks", 
            "Generate EXACTLY 5 fill-in-the-blank exercises for this content.", 
            false
        );

        return NextResponse.json({
            success: true,
            data: result.data?.items?.slice(0, 5) || []
        });
    } catch (error: any) {
        console.error("[Generate FIB] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
