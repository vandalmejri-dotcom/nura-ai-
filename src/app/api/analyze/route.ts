import { NextResponse } from 'next/server';
import { generateTextAnalysis } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Texte manquant" }, { status: 400 });
        }

        const result = await generateTextAnalysis(text);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
