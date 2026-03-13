'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X,
    Check,
    Sparkle,
    ArrowRight,
    Trophy,
    Lightbulb,
    CaretLeft,
    CaretRight,
    ArrowsClockwise,
    Keyboard
} from '@phosphor-icons/react';
import { useStudySets } from '@/context/StudySetsContext';

interface FillBlankQuestion {
    id: string;
    textWithBlank: string;
    correctAnswer: string;
    hint: string;
    mastery?: number; // 0: Unfamiliar, 1: Learning, 2: Familiar, 3: Mastered
}

interface FillInTheBlanksProps {
    questions: FillBlankQuestion[];
    setId: string;
    language?: string | null;
}

export default function FillInTheBlanks({ questions: initialQuestions, setId, language = 'en' }: FillInTheBlanksProps) {
    // 1. ALL HOOKS AT THE TOP
    const { syncMastery } = useStudySets();

    const [questionStates, setQuestionStates] = useState<FillBlankQuestion[]>(() =>
        initialQuestions.map((q, i) => ({
            ...q,
            id: q.id || `fib_${i}`,
            mastery: q.mastery || 0
        }))
    );

    const [workingQueue, setWorkingQueue] = useState<number[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isEvaluated, setIsEvaluated] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [showTermination, setShowTermination] = useState(false);

    // Mastery Tiers Calculation
    const counts = useMemo(() => {
        return questionStates.reduce((acc, q) => {
            const m = q.mastery || 0;
            if (m === 0) acc.Unfamiliar++;
            else if (m === 1) acc.Learning++;
            else if (m === 2) acc.Familiar++;
            else if (m === 3) acc.Mastered++;
            return acc;
        }, { Unfamiliar: 0, Learning: 0, Familiar: 0, Mastered: 0 });
    }, [questionStates]);

    // Initial Queue Load
    useEffect(() => {
        const unmastered = questionStates
            .map((q, i) => (q.mastery! < 3 ? i : -1))
            .filter(i => i !== -1);

        if (unmastered.length > 0) {
            setWorkingQueue(unmastered);
            setCurrentIndex(0);
        } else {
            setShowTermination(true);
        }
    }, []);

    const startNewRound = useCallback(() => {
        const unmastered = questionStates
            .map((q, i) => (q.mastery! < 3 ? i : -1))
            .filter(i => i !== -1);

        if (unmastered.length > 0) {
            setWorkingQueue(unmastered);
            setCurrentIndex(0);
            setShowTermination(false);
            setUserAnswer('');
            setIsEvaluated(false);
            setIsCorrect(null);
            setShowHint(false);
        } else {
            setShowTermination(true);
        }
    }, [questionStates]);

    const validateAnswer = useCallback((input: string, correct: string) => {
        return input.trim().toLowerCase() === correct.trim().toLowerCase();
    }, []);

    const handleSubmit = useCallback(() => {
        const currentIdx = workingQueue[currentIndex];
        const currentQuestion = questionStates[currentIdx];
        if (!currentQuestion || isEvaluated || !userAnswer.trim()) return;

        const correct = validateAnswer(userAnswer, currentQuestion.correctAnswer);
        setIsCorrect(correct);
        setIsEvaluated(true);

        // Update LOCAL state
        setQuestionStates(prev => {
            const next = [...prev];
            const q = { ...next[currentIdx] };
            if (correct) {
                q.mastery = Math.min((q.mastery || 0) + 1, 3);
            } else {
                q.mastery = 0;
            }
            next[currentIdx] = q;
            return next;
        });

        syncMastery(setId, currentQuestion.id, correct ? 'correct' : 'wrong');
    }, [currentIndex, workingQueue, questionStates, isEvaluated, userAnswer, setId, validateAnswer, syncMastery]);

    const handleProceed = useCallback(() => {
        if (currentIndex < workingQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer('');
            setIsEvaluated(false);
            setIsCorrect(null);
            setShowHint(false);
        } else {
            setShowTermination(true);
        }
    }, [currentIndex, workingQueue.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setUserAnswer('');
            setIsEvaluated(false);
            setIsCorrect(null);
            setShowHint(false);
        }
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < workingQueue.length - 1) {
            handleProceed();
        }
    }, [currentIndex, workingQueue.length, handleProceed]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (showTermination) return;
            if (e.key === 'Enter') {
                if (isEvaluated) handleProceed();
                else handleSubmit();
            }
            if (e.key === 'ArrowLeft' && !isEvaluated) handlePrev();
            if (e.key === 'ArrowRight' && !isEvaluated) handleNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleSubmit, handleProceed, handlePrev, handleNext, isEvaluated, showTermination]);

    // Scenario Screens
    if (showTermination) {
        const isFullyMastered = counts.Mastered === questionStates.length;

        if (isFullyMastered) {
            return (
                <div className="flex flex-col items-center justify-center space-y-12 py-10 min-h-[60vh] animate-scale-up text-center px-6">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-[60px] rounded-full group-hover:bg-emerald-500/30 transition-all duration-1000" />
                        <div className="relative w-48 h-48 rounded-[40px] bg-black border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_80px_rgba(16,185,129,0.2)]">
                            <Trophy size={100} weight="fill" className="animate-bounce" />
                        </div>
                        <Sparkle size={54} weight="fill" className="absolute -top-6 -right-6 text-yellow-400 animate-pulse" />
                    </div>

                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            Apex Achieved
                        </div>
                        <h2 className="text-6xl font-black italic tracking-tighter uppercase text-gradient">Mission Accomplished</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-xl mx-auto leading-relaxed">
                            Every concept in this Cloze module has been verified. Your long-term memory integration is optimal.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cloze Tests Mastered</p>
                            <p className="text-3xl font-black text-white">{counts.Mastered} / {questionStates.length}</p>
                        </div>
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Neural Accuracy</p>
                            <p className="text-3xl font-black text-emerald-400">Perfect</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white text-black px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                        >
                            Review All (Read-Only)
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-zinc-800 text-white border border-white/10 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-700 transition-all"
                        >
                            Start New Mission
                        </button>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex flex-col items-center justify-center space-y-12 py-10 min-h-[60vh] animate-slide-up text-center px-6">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-emerald-400">
                            {Math.round((counts.Mastered / questionStates.length) * 100)}%
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase text-emerald-500">ROUND COMPLETE</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
                            Awesome work! You moved {questionStates.length - counts.Unfamiliar} concepts closer to Mastered. Let's tackle the remaining <span className="text-white font-bold">{questionStates.length - counts.Mastered}</span>!
                        </p>
                    </div>

                    <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            style={{ width: `${(counts.Mastered / questionStates.length) * 100}%` }}
                        />
                    </div>

                    <button
                        onClick={startNewRound}
                        className="group relative px-12 py-6 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl overflow-hidden hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-emerald-500/20"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative flex items-center gap-3">
                            Continue Session <ArrowRight size={22} weight="bold" />
                        </span>
                    </button>
                </div>
            );
        }
    }

    const currentIdx = workingQueue[currentIndex];
    const currentQuestion = questionStates[currentIdx];

    if (!currentQuestion) return null;

    return (
        <div className="w-full flex flex-col items-center space-y-10 animate-slide-up">
            {/* Top Mastery Badges */}
            <div className="flex items-center gap-3 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl">
                <Badge label="Unfamiliar" count={counts.Unfamiliar} type="red" />
                <Badge label="Learning" count={counts.Learning} type="orange" />
                <Badge label="Familiar" count={counts.Familiar} type="blue" />
                <Badge label="Mastered" count={counts.Mastered} type="emerald" />
            </div>

            {/* Main Exercise Card */}
            <div className={`relative w-full max-w-4xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border rounded-[48px] p-16 flex flex-col items-center text-center shadow-2xl transition-all duration-500 group/card overflow-hidden
                ${isEvaluated && isCorrect ? 'border-emerald-500/40 shadow-[0_0_80px_rgba(16,185,129,0.15)]' : ''}
                ${isEvaluated && !isCorrect ? 'border-red-500/40 shadow-[0_0_80px_rgba(239,68,68,0.15)]' : ''}
                ${!isEvaluated ? 'border-white/10' : ''}
            `}>
                {/* Visual Glows */}
                <div className={`absolute -top-20 -right-20 w-80 h-80 blur-[120px] rounded-full -z-10 transition-colors duration-700
                    ${isEvaluated && isCorrect ? 'bg-emerald-500/10' : ''}
                    ${isEvaluated && !isCorrect ? 'bg-red-500/10' : ''}
                    ${!isEvaluated ? 'bg-fuchsia-500/5' : ''}
                `} />

                {/* Header Info */}
                <div className="flex items-center gap-3 mb-10">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        Concept Isolation Module
                    </span>
                    <div className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
                        Unit: {currentIndex + 1} / {workingQueue.length}
                    </span>
                </div>

                {/* The Sentence */}
                <div className="text-3xl font-extrabold leading-tight text-white tracking-tight max-w-3xl text-balance mb-12 min-h-[120px] flex items-center justify-center">
                    {currentQuestion.textWithBlank}
                </div>

                {/* Input Area */}
                <div className="w-full max-w-lg space-y-6">
                    <div className="relative group">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => !isEvaluated && setUserAnswer(e.target.value)}
                            disabled={isEvaluated}
                            placeholder="Type your answer..."
                            className={`w-full h-20 bg-black/40 border-2 rounded-[24px] px-8 text-xl font-bold text-center outline-none transition-all duration-300
                                ${!isEvaluated ? 'border-white/5 hover:border-white/20 focus:border-white/40 focus:bg-black/60' : ''}
                                ${isEvaluated && isCorrect ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-400' : ''}
                                ${isEvaluated && !isCorrect ? 'border-red-500/60 bg-red-500/5 text-red-400' : ''}
                            `}
                            autoFocus
                        />
                        {!isEvaluated && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase tracking-widest hidden md:block">
                                <Keyboard size={14} className="inline mr-1" /> ENTER
                            </div>
                        )}
                    </div>

                    {/* Feedback & Correct Answer */}
                    {isEvaluated && !isCorrect && (
                        <div className="animate-fade-in space-y-2">
                            <p className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em]">Correct Answer</p>
                            <p className="text-2xl font-black text-white">{currentQuestion.correctAnswer}</p>
                        </div>
                    )}

                    {/* Hint Section */}
                    <div className="flex flex-col items-center gap-4">
                        {!isEvaluated && !showHint && (
                            <button
                                onClick={() => setShowHint(true)}
                                className="flex items-center gap-2 text-[11px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                            >
                                <Sparkle size={14} /> Need a hint?
                            </button>
                        )}

                        {showHint && (
                            <div className="animate-fade-in p-6 rounded-2xl bg-zinc-800/20 border border-white/5 backdrop-blur-sm max-w-md">
                                <div className="flex items-center gap-2 mb-2 justify-center">
                                    <Lightbulb size={16} className="text-yellow-400" />
                                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Neural Hint</span>
                                </div>
                                <p className="text-zinc-400 text-sm font-medium italic">"{currentQuestion.hint}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Button (Swap Logic) */}
                <div className="mt-12 w-full max-w-sm">
                    {!isEvaluated ? (
                        <button
                            onClick={handleSubmit}
                            disabled={!userAnswer.trim()}
                            className="w-full h-16 bg-white text-black rounded-[20px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                        >
                            Evaluate <Check size={20} weight="bold" />
                        </button>
                    ) : (
                        <button
                            onClick={handleProceed}
                            className={`w-full h-16 rounded-[20px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all
                                ${isCorrect ? 'bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-white text-black'}
                            `}
                        >
                            Sequential Proceed <ArrowRight size={20} weight="bold" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tactical Navigation Bar */}
            <div className="w-full max-w-lg flex items-center justify-between px-8 py-5 bg-white/5 border border-white/10 rounded-[32px] shadow-2xl backdrop-blur-md">
                <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="p-3 rounded-full hover:bg-white/10 transition-all disabled:opacity-20 active:scale-90"
                >
                    <CaretLeft size={24} weight="bold" />
                </button>

                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Progress</span>
                    <span className="text-xl font-bold leading-none tabular-nums">
                        {currentIndex + 1} <span className="text-zinc-600 mx-1">/</span> {workingQueue.length}
                    </span>
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentIndex === workingQueue.length - 1}
                    className="p-3 rounded-full hover:bg-white/10 transition-all disabled:opacity-20 active:scale-90"
                >
                    <CaretRight size={24} weight="bold" />
                </button>
            </div>
        </div>
    );
}

function Badge({ label, count, type }: { label: string, count: number, type: 'red' | 'orange' | 'blue' | 'emerald' }) {
    const styles = {
        red: 'bg-red-500/10 border-red-500/20 text-red-500',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    };
    const dot = {
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500'
    };

    return (
        <div className={`px-5 py-3 rounded-2xl border flex items-center gap-4 ${styles[type]} transition-all duration-700 shadow-xl`}>
            <div className={`w-2.5 h-2.5 rounded-full ${dot[type]} shadow-[0_0_15px_currentColor] animate-pulse`} />
            <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50 leading-none mb-1">{label}</span>
                <span className="text-lg font-black tabular-nums tracking-tighter">{count}</span>
            </div>
        </div>
    );
}
