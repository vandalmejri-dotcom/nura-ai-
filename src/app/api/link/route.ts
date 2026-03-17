import { NextResponse } from 'next/server';

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
        const content = body.text || `Web content from: ${url}`;
        const words = content.split(/\s+/).filter((w: string) => w.length > 4);
        
        const studySet = {
            id: 'temp_' + Date.now(),
            title: url ? 'Link Analysis' : 'Text Analysis',
            sourceName: url ? url : 'Raw Text',
            generatedBy: 'Nura AI (Lazy)',
            sourceContent: content,
            rawContent: content,
            rawContentType: url ? 'link' : 'text',
            status: 'ready',
            stats: {
                wordCount: words.length,
                characterCount: content.length,
                cardCount: 0,
                quizCount: 0,
                fibCount: 0,
            }
        };

        // Attempt persistence
        try {
            const { prisma } = await import('@/lib/prisma');
            const user = await prisma.user.upsert({
                where: { email: 'system@nura.ai' },
                update: {},
                create: { email: 'system@nura.ai', name: 'Nura System User' }
            });

            const dbSet = await prisma.studySet.create({
                data: {
                    title: studySet.title,
                    userId: user.id,
                    rawContent: content,
                    rawContentType: studySet.rawContentType,
                    status: 'ready'
                }
            });
            studySet.id = dbSet.id;
        } catch (e: any) {
            console.warn("[NURA] Persistence failed for generic link/text:", e.message);
        }

        return NextResponse.json({ success: true, data: studySet });
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

    if (!transcript) {
      return NextResponse.json(
        { error: 'YouTube extraction produced no content.' },
        { status: 422 }
      );
    }

    // --- NEW: LAZY GENERATION ARCHITECTURE ---
    // We NO LONGER generate everything at once. We only save and return the transcript.
    const words = transcript.split(/\s+/).filter(w => w.length > 4);
    
    let finalStudySet: any = {
        id: 'temp_' + Date.now(),
        title: metadata?.title || 'YouTube Analysis',
        sourceName: metadata?.title || 'YouTube Video',
        generatedBy: 'Nura AI (Lazy)',
        sourceContent: transcript,
        rawContent: transcript,
        rawContentType: 'youtube',
        sourceUrl: url,
        status: 'ready',
        stats: {
            wordCount: words.length,
            characterCount: transcript.length,
            cardCount: 0,
            quizCount: 0,
            fibCount: 0,
        },
        metadata: {
            ...metadata,
            sourceUrl: url,
            extractedAt: new Date().toISOString()
        }
    };

    try {
        const { prisma } = await import('@/lib/prisma');
        
        const user = await prisma.user.upsert({
            where: { email: 'system@nura.ai' },
            update: {},
            create: {
                email: 'system@nura.ai',
                name: 'Nura System User'
            }
        });

        const dbSet = await prisma.studySet.create({
            data: {
                title: finalStudySet.title,
                userId: user.id,
                rawContent: transcript,
                rawContentType: 'youtube',
                sourceUrl: url,
                status: 'ready',
                metadata: finalStudySet.metadata as any
            }
        });

        finalStudySet.id = dbSet.id;
        console.log(`[NURA] Lazy StudySet created in DB: ${dbSet.id}`);

    } catch (e: any) {
        console.warn("[NURA] Prisma persistence failed:", e.message);
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
