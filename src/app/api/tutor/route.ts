import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { smartGenerate, QUIZ_ARENA_ENGINE_PROMPT, validateQuizItem } from '@/lib/llm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, sourceContent, currentTiers, userChoice } = body;

        if (!sourceContent) {
            return NextResponse.json({ success: false, error: 'Source content is required for the Hermetic Engine.' }, { status: 400 });
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ success: false, error: 'Invalid messages array.' }, { status: 400 });
        }

        // Fetch recent artifacts for grounding if no currentTiers provided
        let masteryState = currentTiers;
        if (!masteryState) {
            masteryState = { Unfamiliar: 10, Learning: 0, Familiar: 0, Mastered: 0 };
        }

        // Inject the rigid Quiz Arena Engine Prompt with the Hermetic Seal
        const systemPrompt = `${QUIZ_ARENA_ENGINE_PROMPT}

[USER_INPUT]:
${sourceContent}

CURRENT MASTERY STATE:
${JSON.stringify(masteryState, null, 2)}

USER CHOICE (IF FEEDBACK):
${userChoice !== undefined ? `Choice ID: ${userChoice}` : "None"}

HISTORY:
${messages.map((m: any) => `${m.role}: ${m.text}`).join('\n')}

INSTRUCTION: Generate the next JSON screen based ONLY on the [USER_INPUT] above.`;

        // Call smartGenerate with JSON mode forced TRUE for this engine
        let validatedData: any = null;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts && !validatedData) {
            attempts++;
            const { text, modelLabel } = await smartGenerate(systemPrompt, true, ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
            
            try {
                const clean = text.replace(/^```json/, '').replace(/```$/, '').trim();
                const parsed = JSON.parse(clean);
                
                // Validate if it's a quiz screen
                if (parsed.screenType === 'question' || parsed.options) {
                    const validated = validateQuizItem(parsed);
                    if (validated) {
                        validatedData = { ...validated, modelLabel };
                    }
                } else {
                    // It might be a regular tutor response
                    validatedData = { ...parsed, modelLabel };
                }
            } catch (e) {
                console.warn(`[NURA] Quiz Generation Attempt ${attempts} failed.`);
            }
        }

        if (!validatedData) {
            throw new Error("Unable to generate a valid high-quality quiz question. Please try again.");
        }

        return NextResponse.json({
            success: true,
            data: validatedData
        });

    } catch (error: any) {
        console.error("Quiz Arena Critical Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
