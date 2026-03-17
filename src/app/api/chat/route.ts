// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { chatTutor } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
    try {
        const { context, message, sourceContent } = await req.json();

        if (!context || !message) {
            return NextResponse.json({ error: 'Missing context or message.' }, { status: 400 });
        }

        // In Next.js serverless, we expect the frontend to send the sourceContent 
        // since the server is stateless and doesn't have the documentStore in-memory between warm-ups.
        const reply = await chatTutor(context, sourceContent || 'No context available.', message);

        return NextResponse.json({ success: true, reply });

    } catch (error: any) {
        console.error('Chat Error:', error.message);
        return NextResponse.json({ error: 'Failed to generate tutor response.' }, { status: 500 });
    }
}
