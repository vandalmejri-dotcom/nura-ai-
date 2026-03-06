// src/app/api/status/route.ts

import { NextResponse } from 'next/server';
import { checkProviderStatus } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';

// Mock checkProviderStatus since I didn't port it fully (it involves quota tracker stats)
// Let's port the real logic from llm-service.js
export async function GET() {
    try {
        const status = await checkProviderStatus();
        return NextResponse.json({ success: true, ...status });
    } catch (err) {
        return NextResponse.json({ success: false });
    }
}
