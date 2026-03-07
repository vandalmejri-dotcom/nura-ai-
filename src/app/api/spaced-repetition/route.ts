import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { artifactId, quality } = body;
        // quality: 0 (Blackout/Forgot), 1 (Hard), 2 (Good/Hesitant), 3 (Perfect/Easy)
        // Standard SM-2 maps quality from 0 to 5. We'll map our 0-3 scale to 0-5 for calculation:
        // 0 -> 0 (Complete failure)
        // 1 -> 3 (Correct with serious difficulty)
        // 2 -> 4 (Correct after hesitation)
        // 3 -> 5 (Perfect response)

        const smQuality = quality === 3 ? 5 : quality === 2 ? 4 : quality === 1 ? 3 : 0;

        if (!artifactId || quality === undefined) {
            return NextResponse.json({ success: false, error: 'Missing artifactId or quality score.' }, { status: 400 });
        }

        const artifact = await prisma.pedagogicalArtifact.findUnique({
            where: { id: artifactId }
        });

        if (!artifact) {
            return NextResponse.json({ success: false, error: 'Artifact not found.' }, { status: 404 });
        }

        let { easeFactor, consecutiveCorrect, masteryLevel, nextReviewDate } = artifact;

        // Current interval calculation based on previous date vs now (very roughly, or deriving from consecutive)
        // Since we don't store exact previous interval, we'll derive it based on SM-2 standard rules:
        let previousInterval = 0;
        if (consecutiveCorrect === 1) previousInterval = 1;
        else if (consecutiveCorrect === 2) previousInterval = 6;
        else if (consecutiveCorrect > 2) {
            // Rough approximation if we didn't store interval strictly
            previousInterval = Math.max(6, Math.round(6 * easeFactor));
        }

        let newInterval = 0;

        if (smQuality < 3) {
            // Unsuccessful recall
            consecutiveCorrect = 0;
            newInterval = 1; // 1 day
            masteryLevel = Math.max(0, masteryLevel - 1); // Downgrade
        } else {
            // Successful recall
            if (consecutiveCorrect === 0) newInterval = 1;
            else if (consecutiveCorrect === 1) newInterval = 6;
            else newInterval = Math.round(previousInterval * easeFactor);

            consecutiveCorrect += 1;

            // Upgrade mastery
            if (consecutiveCorrect === 1) masteryLevel = 1; // Learning
            else if (consecutiveCorrect <= 3) masteryLevel = 2; // Familiar
            else masteryLevel = 3; // Mastered
        }

        // Adjust Ease Factor regardless of success/fail based on SM-2 formula
        easeFactor = easeFactor + (0.1 - (5 - smQuality) * (0.08 + (5 - smQuality) * 0.02));
        if (easeFactor < 1.3) easeFactor = 1.3;

        // Calculate next review timestamp
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        const updatedArtifact = await prisma.pedagogicalArtifact.update({
            where: { id: artifactId },
            data: {
                easeFactor,
                consecutiveCorrect,
                masteryLevel,
                nextReviewDate: nextDate
            }
        });

        return NextResponse.json({
            success: true,
            data: updatedArtifact
        });

    } catch (error: any) {
        console.error("Spaced Repetition Calculation Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
