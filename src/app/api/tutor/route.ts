import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { smartGenerate } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ success: false, error: 'Invalid messages array.' }, { status: 400 });
        }

        // Fetch Unfamiliar items (masteryLevel === 0)
        // Since we don't have user authentication yet, we'll fetch globally or take top 5
        const unfamiliarItems = await prisma.pedagogicalArtifact.findMany({
            where: { masteryLevel: 0 },
            take: 5,
        });

        let contextInjection = '';
        if (unfamiliarItems.length > 0) {
            contextInjection = unfamiliarItems.map((item: any) => JSON.stringify(item.contentPayload)).join('\n');
        } else {
            contextInjection = 'The student currently has no unfamiliar concepts! Praise them and ask if they want to review anything specific.';
        }

        // System prompt instructing the RAG AI Tutor
        const systemPrompt = `You are Nura AI's Proactive Tutor. Your goal is to use Socratic questioning to help the student master their 'Unfamiliar' concepts.
        
Here are their current struggling (Unfamiliar) concepts straight from the database:
${contextInjection}

Do NOT output JSON or Markdown headers. Provide a brief, encouraging, conversational response. If this is the start of the conversation, introduce yourself and immediately ask a probing question about one of the struggling concepts.

Student conversation history so far:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}

TUTOR RESPONSE:`;

        const { text, modelLabel } = await smartGenerate(systemPrompt, false, ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemini-1.5-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-1.5-pro']);

        return NextResponse.json({
            success: true,
            data: {
                text,
                modelLabel
            }
        });

    } catch (error: any) {
        console.error("AI Tutor Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
