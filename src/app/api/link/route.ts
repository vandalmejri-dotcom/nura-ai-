// src/app/api/link/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateStudySet } from '@/lib/llm-service';
import { fetchYouTubeTranscript } from '@/lib/ingestion';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { link, text, options, language } = await req.json();
        let fileContent = '';
        let fileName = 'Pasted Content';

        if (text) {
            fileContent = text;
        } else if (link) {
            if (link.includes('youtube.com') || link.includes('youtu.be')) {
                fileContent = await fetchYouTubeTranscript(link);
                fileName = 'YouTube Video';
            } else {
                fileContent = `Web link: ${link}`;
                fileName = 'Web Link';
            }
        }

        if (!fileContent) {
            return NextResponse.json({ error: 'No content available.' }, { status: 400 });
        }

        const studySet = await generateStudySet(fileName, fileContent, options, language);
        (studySet as any).sourceContent = fileContent;

        return NextResponse.json({ success: true, data: studySet });

    } catch (error: any) {
        console.error('Link Error:', error.message);
        return NextResponse.json({ error: error.message || 'Failed to process link/text.' }, { status: 500 });
    }
}
