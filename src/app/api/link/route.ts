import { NextResponse } from 'next/server';
import { generateStudySet } from '@/lib/llm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: 60s timeout

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { link, url: providedUrl, options, language } = body;
    const url = providedUrl || link;

    const ytUrlRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/;
    
    // --- NON-YOUTUBE BRANCH (FALLBACK TO GENERIC) ---
    if (!url || !ytUrlRegex.test(url)) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: any) => {
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                };
                try {
                    const content = body.text || `Web content from: ${url}`;
                    send({ type: 'debug', message: "Processing core synthesis...", progress: 30 });
                    const studySet = await generateStudySet(url ? 'Link Analysis' : 'Text Analysis', content, options, language);
                    send({ type: 'result', success: true, data: studySet });
                    controller.close();
                } catch (e: any) {
                    send({ type: 'error', error: e.message || "Failed to process content." });
                    controller.close();
                }
            }
        });
        return new NextResponse(stream, {
            headers: { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' },
        });
    }

    // --- YOUTUBE BRANCH (Supadata Harvester) ---
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Could not parse video ID from URL' }, { status: 400 });
    }

    let transcript: string | null = null;
    let metadata: any = null;

    try {
        console.log(`[NURA] Attempting direct extraction via Supadata...`);
        
        const supadataRes = await fetch(
            `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true`,
            {
                method: 'GET',
                headers: { 'x-api-key': process.env.SUPADATA_API_KEY! },
                signal: AbortSignal.timeout(20000),
            }
        );

        if (supadataRes.ok) {
            const sData = await supadataRes.json();
            transcript = sData.content || sData.transcript || '';
            metadata = {
                title: sData.title || 'YouTube Video',
                channel: sData.channel || 'YouTube',
                duration: sData.duration || 0,
                thumbnail: sData.thumbnail || null
            };
            console.log(`[NURA] Direct Supadata Success!`);
        } else {
            const errData = await supadataRes.json().catch(() => ({}));
            throw new Error(errData.error || `Supadata API error: ${supadataRes.status}`);
        }
    } catch (e: any) {
        console.error(`[NURA] YouTube Extraction Failed:`, e.message);
        return NextResponse.json(
            { error: e.message || "YouTube is aggressively blocking. Please use the Raw Text fallback." },
            { status: 422 }
        );
    }

    if (!transcript) {
      return NextResponse.json(
        { error: 'YouTube extraction produced no content.' },
        { status: 422 }
      );
    }

    // Call LLM engine to generate study set
    const studySet = await generateStudySet(metadata?.title || 'YouTube Analysis', transcript, options, language);

    // Persistence (Fix for Bug 1) - Real DB Persistence
    let finalStudySet = {
        ...studySet,
        sourceContent: transcript,
        rawContent: transcript,
        rawContentType: 'youtube',
        status: 'ready',
        metadata: {
            ...metadata,
            sourceUrl: url,
            extractedAt: new Date().toISOString()
        }
    };

    try {
        const { prisma } = await import('@/lib/prisma');
        
        // 1. Ensure a default user exists for the StudySet relation
        const user = await prisma.user.upsert({
            where: { email: 'system@nura.ai' },
            update: {},
            create: {
                email: 'system@nura.ai',
                name: 'Nura System User'
            }
        });

        // 2. Create the StudySet in the database
        const dbSet = await prisma.studySet.create({
            data: {
                title: finalStudySet.title,
                userId: user.id,
                rawContent: transcript,
                rawContentType: 'youtube',
                status: 'ready',
                metadata: finalStudySet.metadata as any
            }
        });

        // 3. Update the ID to the DB generated one
        finalStudySet.id = dbSet.id;
        console.log(`[NURA] StudySet persisted to DB with ID: ${dbSet.id}`);

    } catch (e: any) {
        console.warn("[NURA] Prisma persistence failed:", e.message);
        // Fallback to memory ID if DB fails
    }

    return NextResponse.json({
      success: true,
      data: finalStudySet
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[YouTube Harvester] Fatal:', message);
    return NextResponse.json(
      { error: 'Transcript extraction failed. Please try again.' },
      { status: 500 }
    );
  }
}
