import { NextResponse } from 'next/server';
import { generateStudySetTitle } from '@/lib/llm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

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
    const { url } = await req.json();

    const ytUrlRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/;
    if (!url || !ytUrlRegex.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);

    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      console.error('[Supadata] SUPADATA_API_KEY is not set');
      return NextResponse.json(
        { error: 'Transcript service is not configured.' },
        { status: 500 }
      );
    }

    const supadataUrl = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true`;

    const [transcriptRes, oEmbedTitle] = await Promise.all([
      fetch(supadataUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(8000),
      }),
      videoId ? getYouTubeTitle(videoId) : Promise.resolve('')
    ]);

    if (!transcriptRes.ok) {
      const errBody = await transcriptRes.json().catch(() => ({}));
      console.error('[Supadata] API error:', transcriptRes.status, errBody);

      if (transcriptRes.status === 404) {
        return NextResponse.json(
          { error: 'No transcript available for this video. Captions may be disabled.' },
          { status: 422 }
        );
      }
      if (transcriptRes.status === 401) {
        return NextResponse.json(
          { error: 'Transcript service authentication failed.' },
          { status: 500 }
        );
      }
      throw new Error(`Supadata responded with ${transcriptRes.status}`);
    }

    const data = await transcriptRes.json();
    const transcript: string = data.content ?? '';

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: 'Transcript is empty or too short (min 100 chars) to process.' },
        { status: 422 }
      );
    }

    // Fix: Use oEmbed title first, then Supadata title, fallback to AI generation
    const sourceTitle = oEmbedTitle || data.title;
    const generatedTitle = (sourceTitle && sourceTitle !== 'Unknown Title' && sourceTitle !== 'YouTube Video')
      ? sourceTitle
      : await generateStudySetTitle(transcript);

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        title: generatedTitle,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        metadata: {
          title: generatedTitle,
          duration: data.duration ?? 0,
          channel: data.channel ?? 'Unknown',
          thumbnail: null,
          sourceUrl: url,
          extractedAt: new Date().toISOString(),
        },
      },
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
