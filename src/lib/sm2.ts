/**
 * SM-2 Algorithm Implementation (Scientific Spaced Repetition)
 * Adapted for Nura AI Cognitive Engine.
 */

export interface SM2Result {
    interval: number;
    easeFactor: number;
    nextReviewDate: Date;
    masteryLevel: number;
}

export type ReviewGrade = 'hard' | 'good' | 'easy' | 'forget';

const gradeMap: Record<ReviewGrade, number> = {
    'forget': 0,
    'hard': 3,
    'good': 4,
    'easy': 5,
};

export function calculateSM2(
    currentInterval: number,
    currentEaseFactor: number,
    gradeKey: ReviewGrade
): SM2Result {
    const q = gradeMap[gradeKey];
    let interval: number;
    let easeFactor: number;

    // EF' := EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    if (q >= 3) {
        if (currentInterval === 0) {
            interval = 1;
        } else if (currentInterval === 1) {
            interval = 6;
        } else {
            interval = Math.round(currentInterval * easeFactor);
        }
    } else {
        // Reset sequence for forgotten items
        interval = 1;
    }

    // Determine Mastery Level based on interval lengths
    // 0: Unfamiliar (< 1 day)
    // 1: Learning (1-6 days)
    // 2: Familiar (6-30 days)
    // 3: Mastered (> 30 days)
    let masteryLevel = 0;
    if (q >= 3) {
        if (interval > 30) masteryLevel = 3;
        else if (interval > 6) masteryLevel = 2;
        else masteryLevel = 1;
    } else {
        masteryLevel = 0;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
        interval,
        easeFactor,
        nextReviewDate,
        masteryLevel,
    };
}
