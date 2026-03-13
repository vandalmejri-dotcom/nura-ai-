'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Check,
    ArrowLeft,
    ArrowRight,
    Sparkle,
    Warning,
    Trophy
} from '@phosphor-icons/react';
import { useStudySets, StudySet } from '@/context/StudySetsContext';

interface QuizArenaProps {
    quiz: any[];
    set: StudySet;
}

export default function QuizArena({ quiz: initialQuiz, set }: QuizArenaProps) {
    // -------------------------------------------------------------------------
    // 1. NEURAL STATE (MASTERY LOOP ARCHITECTURE)
    // -------------------------------------------------------------------------
    const { syncMastery } = useStudySets();

    const [questions, setQuestions] = useState<any[]>(Array.isArray(initialQuiz) && initialQuiz.length > 0 ? initialQuiz : []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showTermination, setShowTermination] = useState(false);

    // Active Per-Question State
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isEvaluated, setIsEvaluated] = useState(false);
    const [showRationale, setShowRationale] = useState(false);

    // Navigation Safety Lock
    const isNavigating = useRef(false);

    // Dynamic Mission Count (Infinite Mastery Pool)
    const totalMissionSteps = 10;

    // Derived counts for termination screens
    const counts = useMemo(() => {
        return set.masteryTiers || { Unfamiliar: 0, Learning: 0, Familiar: 0, Mastered: 0 };
    }, [set.masteryTiers]);

    const totalConcepts = useMemo(() => {
        return counts.Unfamiliar + counts.Learning + counts.Familiar + counts.Mastered;
    }, [counts]);

    // Initial Load
    useEffect(() => {
        if (questions.length > 0) return;
        const init = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/tutor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{ role: 'user', text: 'Start quiz mission.' }],
                        sourceContent: set.rawContent || set.sourceContent,
                        currentTiers: set.masteryTiers
                    })
                });
                const result = await res.json();
                if (result.success && result.data) {
                    setQuestions([result.data]);
                }
            } catch (e) {
                console.error("Init Error", e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, [set.id, questions.length]);

    // -------------------------------------------------------------------------
    // 2. THE MASTERY FLOW HANDLERS
    // -------------------------------------------------------------------------

    const startNewRound = useCallback(() => {
        setShowTermination(false);
        setCurrentIndex(0);
        setSelectedId(null);
        setIsEvaluated(false);
        setShowRationale(false);
        // In generative mode, we might want to clear questions and start fresh or keep them
        // User said "Filter original array", but QuizArena is generative.
        // We'll reset the index and let it generate/fetch as needed.
    }, []);

    const handleAnswer = useCallback((choiceId: number) => {
        if (isEvaluated || isLoading || isNavigating.current) return;

        setSelectedId(choiceId);
        setIsEvaluated(true);

        const q = questions[currentIndex];
        const opt = q?.options?.find((o: any) => o.id === choiceId);
        if (opt) {
            syncMastery(set.id, q.conceptId || `quiz_concept_${currentIndex}`, opt.isCorrect ? 'correct' : 'wrong');
        }
    }, [isEvaluated, isLoading, questions, currentIndex, set.id, syncMastery]);

    const handleNext = useCallback(async () => {
        if (isLoading || isNavigating.current) return;

        // Termination Check
        if (currentIndex + 1 >= totalMissionSteps) {
            setShowTermination(true);
            return;
        }

        // Path A: Move to already generated question
        if (currentIndex < questions.length - 1) {
            isNavigating.current = true;
            setSelectedId(null);
            setIsEvaluated(false);
            setShowRationale(false);
            setCurrentIndex(prev => prev + 1);
            isNavigating.current = false;
            return;
        }

        // Path B: Generate next challenge
        isNavigating.current = true;
        setSelectedId(null);
        setIsEvaluated(false);
        setShowRationale(false);
        setIsLoading(true);

        try {
            const res = await fetch('/api/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        text: 'Target the most unfamiliar concepts. Priority: Unfamiliar > Learning > Familiar.'
                    }],
                    sourceContent: set.rawContent || set.sourceContent,
                    currentTiers: set.masteryTiers,
                    targeting: 'weakest_link'
                })
            });
            const result = await res.json();
            if (result.success && result.data) {
                setQuestions(prev => [...prev, result.data]);
                setCurrentIndex(prev => prev + 1);
            }
        } catch (e) {
            console.error("Mastery Loop Expansion Failure", e);
        } finally {
            setIsLoading(false);
            setTimeout(() => { isNavigating.current = false; }, 300);
        }
    }, [currentIndex, questions.length, isLoading, set.id, set.rawContent, set.sourceContent, set.masteryTiers, totalMissionSteps]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0 && !isLoading && !isNavigating.current) {
            isNavigating.current = true;
            setSelectedId(null);
            setIsEvaluated(false);
            setShowRationale(false);
            setCurrentIndex(prev => prev - 1);
            isNavigating.current = false;
        }
    }, [currentIndex, isLoading]);

    // -------------------------------------------------------------------------
    // 3. UI RENDER ENGINE
    // -------------------------------------------------------------------------
    if (showTermination) {
        const isFullyMastered = counts.Mastered >= totalConcepts && totalConcepts > 0;

        if (isFullyMastered) {
            return (
                <div className="flex flex-col items-center justify-center space-y-12 py-10 min-h-[60vh] animate-scale-up text-center px-6">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full" />
                        <div className="relative w-48 h-48 rounded-[40px] bg-black border-2 border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-[0_0_80px_rgba(99,102,241,0.2)]">
                            <Trophy size={100} weight="fill" className="animate-bounce" />
                        </div>
                        <Sparkle size={54} weight="fill" className="absolute -top-6 -right-6 text-yellow-400 animate-pulse" />
                    </div>

                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            Neural Sync Complete
                        </div>
                        <h2 className="text-6xl font-black italic tracking-tighter uppercase text-gradient">Mission Accomplished</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-xl mx-auto leading-relaxed">
                            You have successfully solved every neural puzzle in this sector. Your mastery is absolute.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Concepts Mastered</p>
                            <p className="text-3xl font-black text-white">{counts.Mastered} / {totalConcepts}</p>
                        </div>
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Success Rate</p>
                            <p className="text-3xl font-black text-indigo-400">100%</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={startNewRound}
                            className="bg-white text-black px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                        >
                            Endless Challenge
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-zinc-800 text-white border border-white/10 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-700 transition-all"
                        >
                            Return to Base
                        </button>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex flex-col items-center justify-center space-y-12 py-10 min-h-[60vh] animate-slide-up text-center px-6">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-indigo-400">
                            {Math.round((counts.Mastered / totalConcepts) * 100)}%
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase text-indigo-500">Bout Complete</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
                            Solid performance. You are closing the gap on <span className="text-indigo-400 font-bold">{totalConcepts - counts.Mastered}</span> unmastered concepts. Ready for the next round?
                        </p>
                    </div>

                    <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                            style={{ width: `${(counts.Mastered / totalConcepts) * 100}%` }}
                        />
                    </div>

                    <button
                        onClick={startNewRound}
                        className="group relative px-12 py-6 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl overflow-hidden hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-600/20"
                    >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative flex items-center gap-3">
                            Restart Mastery Bout <ArrowRight size={22} weight="bold" />
                        </span>
                    </button>
                </div>
            );
        }
    }

    const currentQ = questions[currentIndex];

    if (isLoading && questions.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div className="w-12 h-12 border-2 border-white/5 border-t-fuchsia-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Initializing Mastery Loop...</p>
        </div>
    );

    if (!currentQ) return null;

    return (
        <div key={currentIndex} className="max-w-5xl mx-auto py-8 space-y-12 animate-fade-in relative z-10">
            {/* HUD: Balanced & High-Performance Design */}
            <div className="flex flex-col items-center gap-10">
                <div className="flex flex-col items-center gap-1 text-center">
                    <div className="px-5 py-1.5 bg-white/[0.03] border border-white/5 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-[0.8em] mb-4">
                        Mastery Protocol: Active
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-gradient leading-none">
                        {currentQ.quizTitle || currentQ.title || "Concept Synthesis"}
                    </h2>
                </div>

                {/* Mastery State HUD */}
                <div className="flex items-center gap-4 p-2 bg-black shadow-2xl rounded-[32px] border border-white/5">
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-500 ${counts.Unfamiliar ? 'bg-red-500/10 border-red-500/20' : 'opacity-20 translate-y-1 scale-95'}`}>
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">{counts.Unfamiliar || 0} Unfamiliar</span>
                    </div>
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-500 ${counts.Learning ? 'bg-orange-500/10 border-orange-500/20' : 'opacity-20 translate-y-1 scale-95'}`}>
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">{counts.Learning || 0} Learning</span>
                    </div>
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-500 ${counts.Familiar ? 'bg-blue-500/10 border-blue-500/20' : 'opacity-20 translate-y-1 scale-95'}`}>
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{counts.Familiar || 0} Familiar</span>
                    </div>
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-500 ${counts.Mastered ? 'bg-emerald-500/10 border-emerald-500/20' : 'opacity-20 translate-y-1 scale-95'}`}>
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">{counts.Mastered || 0} Mastered</span>
                    </div>
                </div>
            </div>

            {/* Question Display */}
            <div className="text-center space-y-8 px-4 flex flex-col items-center justify-center min-h-[180px] relative">
                <div className="absolute inset-0 bg-fuchsia-500/[0.02] blur-[120px] -z-10" />
                <div className="px-6 py-2 bg-zinc-900 border border-white/5 rounded-full text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] shadow-lg">
                    {currentQ.bloomLevel || currentQ.difficulty || "Neural Probe"}
                </div>
                <h3 className="text-3xl md:text-5xl font-extrabold leading-[1.15] tracking-tight text-white max-w-5xl drop-shadow-2xl">
                    {currentQ.questionText || currentQ.question}
                </h3>
            </div>

            {/* Matrix of Possible Continuations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-4 relative z-20">
                {(currentQ.options || []).map((opt: any, i: number) => {
                    const isChoice = selectedId === opt.id;
                    const isRight = opt.isCorrect;

                    let styles = "bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/5 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl active:scale-95";
                    if (isEvaluated) {
                        if (isRight) styles = "bg-emerald-500/10 border-emerald-500/40 text-emerald-100 shadow-[0_0_40px_rgba(16,185,129,0.1)]";
                        else if (isChoice) styles = "bg-red-500/10 border-red-500/40 text-red-100 shadow-[0_0_40px_rgba(239,68,68,0.1)]";
                        else styles = "bg-white/[0.01] border-white/5 opacity-10 grayscale pointer-events-none";
                    }

                    return (
                        <button
                            key={opt.id || i}
                            type="button"
                            disabled={isEvaluated || isLoading}
                            onClick={() => handleAnswer(opt.id)}
                            className={`group p-8 rounded-[48px] border text-left transition-all duration-500 min-h-[140px] flex items-center gap-8 ${styles}`}
                        >
                            <div className={`w-14 h-14 rounded-3xl shrink-0 flex items-center justify-center font-black text-xl border-2 transition-all duration-500 ${isEvaluated
                                ? (isRight ? 'bg-emerald-500 border-emerald-300 text-white shadow-lg' : isChoice ? 'bg-red-500 border-red-300 text-white shadow-lg' : 'bg-zinc-950 border-white/5 text-zinc-800')
                                : 'bg-zinc-900 border-white/10 text-zinc-500 group-hover:border-white/30 group-hover:text-white shadow-inner'
                                }`}>
                                {i + 1}
                            </div>
                            <span className="text-xl font-bold leading-snug tracking-tight">{opt.text || opt.answer}</span>
                            {isEvaluated && isRight && <Check weight="bold" size={32} className="ml-auto text-emerald-500 animate-bounce-in" />}
                            {isEvaluated && isChoice && !isRight && <Warning weight="fill" size={32} className="ml-auto text-red-500 animate-shake" />}
                        </button>
                    );
                })}
            </div>

            {/* Tactical Action Bar */}
            <div className="flex flex-col items-center gap-12 pt-10 min-h-[180px] px-4">
                {isEvaluated && (
                    <div className="w-full space-y-10 animate-slide-up">
                        <div className="flex items-center justify-between border-b border-white/5 pb-10">
                            <div className="flex items-center gap-5">
                                <div className={`w-1.5 h-14 rounded-full ${currentQ.options?.find((o: any) => o.id === selectedId)?.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Evaluation Result</span>
                                    <span className="text-sm font-bold text-zinc-400 capitalize">{currentQ.options?.find((o: any) => o.id === selectedId)?.isCorrect ? 'Neural Match Verified' : 'Neural Pattern Conflict'}</span>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowRationale(!showRationale)}
                                    className="px-8 py-5 rounded-3xl bg-white/5 border border-white/10 text-zinc-300 font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all shadow-xl flex items-center gap-3 backdrop-blur-md"
                                >
                                    <Sparkle size={18} weight="fill" className="text-indigo-400" /> {showRationale ? "Retract" : "Rationale"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-3xl shadow-[0_20px_60px_rgba(37,99,235,0.3)] hover:scale-105 transition-all active:scale-95 border border-white/10"
                                >
                                    Sequential Proceed
                                </button>
                            </div>
                        </div>

                        {showRationale && (
                            <div className="p-12 rounded-[56px] bg-black/60 backdrop-blur-3xl border border-white/10 animate-slide-up relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-500 to-indigo-500" />
                                <h4 className="text-[10px] font-black text-zinc-600 tracking-[0.5em] uppercase mb-8 flex items-center gap-3 italic">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" /> Logic Synthesis
                                </h4>
                                <p className="text-white/80 leading-relaxed text-2xl font-medium tracking-tight">
                                    {currentQ.explanation || currentQ.rationale || "The conceptual bridge for this probe has been mapped."}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tactical Navigation HUD: Fixed 1/10 Mastery Loop */}
                <div className="w-full flex items-center justify-between border-t border-white/5 pt-12 mt-auto">
                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0 || isLoading}
                        className="p-6 rounded-[24px] bg-white/5 text-zinc-500 hover:text-white transition-all disabled:opacity-0 hover:bg-white/10 active:scale-90 border border-transparent hover:border-white/10 shadow-lg"
                    >
                        <ArrowLeft size={24} weight="bold" />
                    </button>

                    <nav className="flex flex-col items-center gap-5">
                        <div className="flex items-center gap-6 text-[15px] font-black tracking-[0.6em] uppercase">
                            <span className="text-white">{(currentIndex + 1).toString().padStart(2, '0')}</span>
                            <span className="text-zinc-800 font-light text-sm italic py-1 opacity-40">/</span>
                            <span className="text-zinc-700 opacity-30">{totalMissionSteps.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="w-72 h-1.5 bg-white/[0.02] rounded-full overflow-hidden shadow-inner relative">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 transition-all duration-1000 ease-out"
                                style={{ width: `${Math.min(((currentIndex + 1) / totalMissionSteps) * 100, 100)}%` }}
                            />
                        </div>
                    </nav>

                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={isLoading}
                        className="p-6 rounded-[24px] bg-white/5 text-zinc-400 hover:text-white transition-all hover:bg-white/10 active:scale-90 border border-transparent hover:border-white/10 shadow-lg group"
                    >
                        <ArrowRight size={24} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
