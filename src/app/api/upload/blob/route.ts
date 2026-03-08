import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
                // Return constraints and payload correctly
                return {
                    allowedContentTypes: [
                        'application/pdf',
                        'image/jpeg',
                        'image/png',
                        'text/plain',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/msword'
                    ],
                    tokenPayload: clientPayload,
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log('Vercel Blob upload completed:', blob, tokenPayload);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error('Vercel Blob Handshake Error:', error);
        return NextResponse.json(
            { error: (error as Error).message || 'Handshake failed' },
            { status: 400 } // Send a clear error response
        );
    }
}



