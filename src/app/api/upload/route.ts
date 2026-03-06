// src/app/api/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateStudySet } from '@/lib/llm-service';
import { parsePDF, parseDOCX } from '@/lib/ingestion';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { blobUrl, fileName, options, language } = body;

        if (!blobUrl || !blobUrl.includes('public.blob.vercel-storage.com')) {
            return NextResponse.json({ success: false, error: "Invalid or unauthorized storage URL provided." }, { status: 400 });
        }

        // Fetch the file from Vercel Blob
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let text = '';
        if (fileName.toLowerCase().endsWith('.pdf')) {
            text = await parsePDF(buffer);
        } else if (fileName.toLowerCase().endsWith('.docx')) {
            text = await parseDOCX(buffer);
        } else {
            text = buffer.toString('utf-8');
        }

        if (!text || text.length < 10) {
            return NextResponse.json({ success: false, error: "Document is too short or unreadable." }, { status: 400 });
        }

        // Generate study set using LLM
        const studySet = await generateStudySet(text, options, language);

        return NextResponse.json({
            success: true,
            data: {
                ...studySet,
                sourceName: fileName
            }
        });

    } catch (error: any) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
