import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function parseXMLCaptions(xml: string): string {
  // Remove XML tags, decode HTML entities, deduplicate lines
  const lines: string[] = [];
  let lastLine = '';

  const textMatches = xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
  for (const match of textMatches) {
    const decoded = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (decoded && decoded !== lastLine) {
      lines.push(decoded);
      lastLine = decoded;
    }
  }

  // Group into paragraphs every 8 lines
  const paragraphs: string[] = [];
  for (let i = 0; i < lines.length; i += 8) {
    paragraphs.push(lines.slice(i, i + 8).join(' '));
  }
  return paragraphs.join('\n\n');
}

async function getPlayerResponse(videoId: string): Promise<any> {
  // METHOD 1: Scrape ytInitialPlayerResponse from the watch page
  try {
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
      }
    );

    if (pageRes.ok) {
      const html = await pageRes.text();
      // Extract the JSON blob — it's always between these markers
      const startMarker = 'var ytInitialPlayerResponse = ';
      const startIdx = html.indexOf(startMarker);
      if (startIdx !== -1) {
        const jsonStart = startIdx + startMarker.length;
        // Find the matching closing brace
        let depth = 0;
        let endIdx = jsonStart;
        for (let i = jsonStart; i < html.length; i++) {
          if (html[i] === '{') depth++;
          else if (html[i] === '}') {
            depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
        }
        const jsonStr = html.slice(jsonStart, endIdx);
        return JSON.parse(jsonStr);
      }
    }
  } catch (e) {
    console.warn('[Harvester] Page scrape failed, trying InnerTube API');
  }

  // METHOD 2: InnerTube API (different endpoint, different bot detection)
  const innertube = await fetch(
    'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'en',
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!innertube.ok) throw new Error(`InnerTube failed: ${innertube.status}`);
  return innertube.json();
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  const playerResponse = await getPlayerResponse(videoId);

  // Navigate to caption tracks
  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    return null;
  }

  // Pick best English track
  const track =
    captionTracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ??
    captionTracks.find((t: any) => t.languageCode === 'en') ??
    captionTracks.find((t: any) => t.languageCode?.startsWith('en')) ??
    captionTracks[0];

  if (!track?.baseUrl) return null;

  // Fetch the actual caption XML — this hits timedtext servers, not main YT
  const captionRes = await fetch(track.baseUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!captionRes.ok) return null;

  const xml = await captionRes.text();
  return parseXMLCaptions(xml);
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    const ytUrlRegex =
      /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/;
    if (!url || !ytUrlRegex.test(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Could not parse video ID' }, { status: 400 });
    }

    const transcript = await fetchTranscript(videoId);

    if (!transcript || transcript.length < 50) {
      return NextResponse.json(
        { error: 'No transcript available. This video may have captions disabled.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        metadata: {
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
