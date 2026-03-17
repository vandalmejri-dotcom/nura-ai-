// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { chatTutor } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
    try {
        const { messages, message, sourceContent } = await req.json();

        // LOGS AS PER STEP 1
        console.log('[Tutor] User message:', message);
        console.log('[Tutor] Content available:', sourceContent?.length);
        console.log('[Tutor] History length:', messages?.length);

        if (!message) {
            return NextResponse.json({ error: 'Missing message.' }, { status: 400 });
        }

        // Use messages array for history if available, fallback to empty array
        const conversationHistory = messages || [];

        const reply = await chatTutor(conversationHistory, sourceContent || 'No context available.', message);

        return NextResponse.json({ success: true, reply });

    } catch (error: any) {
        console.error('Chat Error:', error.message);
        return NextResponse.json({ error: 'Failed to generate tutor response.' }, { status: 500 });
    }
}
