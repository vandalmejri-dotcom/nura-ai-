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

        const result = await generateTextAnalysis(
            text, 
            "synthesized_notes", 
            "Create a structured AI synthesis for this content.", 
            true // Use quality model for synthesis
        );

        return NextResponse.json({
            success: true,
            data: result.data?.items || ""
        });
    } catch (error: any) {
        console.error("[Generate Synthesis] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
