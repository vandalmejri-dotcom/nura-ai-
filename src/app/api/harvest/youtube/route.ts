import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = 'nodejs';
export const maxDuration = 30;

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
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
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not parse video ID from URL' },
        { status: 400 }
      );
    }

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for this video.' },
        { status: 422 }
      );
    }

    const transcript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        metadata: {
          title: 'Unknown Title',
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
    console.error('[YouTube Harvester] Error:', message);

    if (message.includes('Could not get transcripts')) {
      return NextResponse.json(
        { error: 'No transcript available. This video may have captions disabled.' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Transcript extraction failed. Please try again.' },
      { status: 500 }
    );
  }
}
