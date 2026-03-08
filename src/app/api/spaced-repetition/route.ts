import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateSM2, type ReviewGrade } from '@/lib/sm2';

export const dynamic = 'force-dynamic';

/**
 * REFINED SPACED REPETITION ENGINE
 * 
 * This route applies the SM-2 algorithm to a pedagogical artifact (flashcard, quiz, etc.)
 * based on user performance.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { artifactId, grade } = body; // grade: 'forget', 'hard', 'good', 'easy'

        if (!artifactId || !grade) {
            return NextResponse.json({
                success: false,
                error: 'Missing artifactId or grade (forget, hard, good, easy).'
            }, { status: 400 });
        }

        const artifact = await prisma.pedagogicalArtifact.findUnique({
            where: { id: artifactId }
        });

        if (!artifact) {
            return NextResponse.json({ success: false, error: 'Artifact not found.' }, { status: 404 });
        }

        // Apply SM-2 Logic
        const {
            interval,
            easeFactor,
            nextReviewDate,
            masteryLevel
        } = calculateSM2(
            artifact.interval,
            artifact.easeFactor,
            grade as ReviewGrade
        );

        // Update Database
        const updatedArtifact = await prisma.pedagogicalArtifact.update({
            where: { id: artifactId },
            data: {
                interval,
                easeFactor,
                nextReviewDate,
                masteryLevel,
                consecutiveCorrect: grade === 'forget' ? 0 : { increment: 1 }
            }
        });

        return NextResponse.json({
            success: true,
            data: updatedArtifact
        });

    } catch (error: any) {
        console.error("Cognitive Engine Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
