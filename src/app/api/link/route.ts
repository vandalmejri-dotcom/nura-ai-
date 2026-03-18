import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

async function getYouTubeTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return '';
    const data = await res.json();
    return data.title ?? '';
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { url, studySetId } = await req.json();

    // Validate URL
    const ytUrlRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/;
    if (!url || !ytUrlRegex.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not parse video ID from URL' },
        { status: 400 }
      );
    }

    // Check transcript service is configured
    const serviceUrl = process.env.TRANSCRIPT_SERVICE_URL;
    if (!serviceUrl) {
      console.error('[Harvest] TRANSCRIPT_SERVICE_URL is not set');
      return NextResponse.json(
        { error: 'Transcript service is not configured.' },
        { status: 500 }
      );
    }

    // Fetch transcript from Render service
    console.log('[Harvest] Fetching transcript for:', videoId);
    const transcriptRes = await fetch(`${serviceUrl}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20000),
    });

    const transcriptData = await transcriptRes.json();

    if (!transcriptRes.ok) {
      console.error('[Harvest] Transcript service error:', transcriptData);
      return NextResponse.json(
        { error: transcriptData.detail ?? 'Transcript unavailable for this video.' },
        { status: transcriptRes.status }
      );
    }

    const transcript: string = transcriptData.transcript ?? '';

    if (!transcript || transcript.length < 50) {
      return NextResponse.json(
        { error: 'Transcript is empty or too short to process.' },
        { status: 422 }
      );
    }

    console.log('[Harvest] Transcript length:', transcript.length);

    // Get video title from YouTube oEmbed (free, no auth needed)
    const videoTitle = await getYouTubeTitle(videoId);
    const title = videoTitle || 'YouTube Video';

    console.log('[Harvest] Video title:', title);

    // Save to database if studySetId provided
    if (studySetId) {
      await prisma.studySet.update({
        where: { id: studySetId },
        data: {
          title,
          rawContent: transcript,
          rawContentType: 'youtube',
          sourceUrl: url,
          status: 'ready',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        title,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        metadata: {
          title,
          duration: 0,
          channel: 'Unknown',
          thumbnail: null,
          sourceUrl: url,
          extractedAt: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[YouTube Harvester] Fatal:', message);

    if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Transcript service is temporarily unavailable. Please try again in 30 seconds.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Transcript extraction failed. Please try again.' },
      { status: 500 }
    );
  }
}
