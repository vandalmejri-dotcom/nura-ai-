'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X,
    Check,
    Sparkle,
    ArrowsClockwise,
    Trophy,
    Keyboard,
    CaretLeft,
    CaretRight,
    ArrowRight
} from '@phosphor-icons/react';
import { useStudySets } from '@/context/StudySetsContext';

interface Card {
    id: string;
    front?: string;
    question?: string;
    back?: string;
    answer?: string;
    mastery?: number; // 0: Unfamiliar, 1: Learning, 2: Familiar, 3: Mastered
}

interface FlashcardMasteryLoopProps {
    set: any;
    language?: string | null;
}

const DICTIONARY: Record<string, any> = {
    en: {
        btnKnewIt: "I knew it",
        btnForgot: "I didn't know it",
        shortcutSpace: "Space to flip",
        progressMastery: "Mastery Progress",
        clickToInvert: "Click or Tap to Invert Probe",
        missionAccomplished: "Mission Accomplished",
        victoryText: "You have completely mastered this topic. All concepts have been encoded into your long-term memory architecture.",
        reviewAgain: "Review Again",
        flip: "Flip",
        demote: "Demote",
        promote: "Promote",
        neuralProbe: "Neural Probe"
    },
    fr: {
        btnKnewIt: "J'ai su",
        btnForgot: "Je n'ai pas su",
        shortcutSpace: "Espace pour retourner",
        progressMastery: "Progression",
        clickToInvert: "Cliquez pour retourner",
        missionAccomplished: "Mission Accomplie",
        victoryText: "Tu as complètement maîtrisé ce sujet. Tous les concepts ont été encodés dans ta mémoire à long terme.",
        reviewAgain: "Réviser à nouveau",
        flip: "Retourner",
        demote: "Rétrograder",
        promote: "Promouvoir",
        neuralProbe: "Sonde Neurale"
    },
    es: {
        btnKnewIt: "Lo sabía",
        btnForgot: "No lo sabía",
        shortcutSpace: "Espacio para voltear",
        progressMastery: "Progreso de Maestría",
        clickToInvert: "Haz clic para voltear",
        missionAccomplished: "Misión Cumplida",
        victoryText: "Has dominado completamente este tema. Todos los conceptos han sido codificados en tu memoria a largo plazo.",
        reviewAgain: "Revisar de nuevo",
        flip: "Voltear",
        demote: "Degradar",
        promote: "Promover",
        neuralProbe: "Sonda Neural"
    }
};

export default function FlashcardMasteryLoop({ set, language = 'en' }: FlashcardMasteryLoopProps) {
    // 1. ALL HOOKS AT THE TOP
    const { syncMastery, updateSet } = useStudySets();
    const [isGenerating, setIsGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    const [cardStates, setCardStates] = useState<Card[]>(() => {
        const initialCards = set.flashcards || [];
        if (initialCards.length === 0) return [];
        return initialCards.map((c: any, i: number) => ({
            ...c,
            id: c.id || `card_${i}`,
            mastery: c.mastery || 0
        })).filter((card: any) => {
            const text = (card.front || card.question || "").toLowerCase();
            return !text.includes("____") && !text.includes("fill in");
        });
    });

    useEffect(() => {
        if (set.flashcards && set.flashcards.length > 0 && cardStates.length === 0) {
            setCardStates(set.flashcards.map((c: any, i: number) => ({
                ...c,
                id: c.id || `card_${i}`,
                mastery: c.mastery || 0
            })));
        }
    }, [set.flashcards]);

    const handleGenerate = useCallback(async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setGenError(null);

        console.log(`[FlashcardMasteryLoop] Triggering generation for setId: ${set.id}`);
        try {
            const res = await fetch('/api/generate/flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setId: set.id, language })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                if (res.status === 504 || errorData.code === 'FUNCTION_INVOCATION_TIMEOUT') {
                    throw new Error("The AI brain timed out. This video transcript might be too long for the free tier. Try a shorter one.");
                }
                throw new Error(errorData.error || "Flashcard generation failure.");
            }
            const result = await res.json();

            if (result.success && result.data) {
                const newCards = result.data.map((c: any, i: number) => ({
                    ...c,
                    id: `card_${Date.now()}_${i}`,
                    mastery: 0
                }));
                setCardStates(newCards);
                
                updateSet(set.id, { 
                    flashcards: newCards,
                    stats: {
                        ...(set.stats || {}),
                        cardCount: newCards.length 
                    }
                });
            }
        } catch (err: any) {
            setGenError(err.message);
        } finally {
            setIsGenerating(false);
        }
    }, [set.id, set.stats, language, isGenerating, updateSet]);

    // Auto-trigger if empty
    useEffect(() => {
        if (cardStates.length === 0 && !isGenerating && !genError) {
            handleGenerate();
        }
    }, [cardStates.length, isGenerating, genError, handleGenerate]);

    const [isFlipped, setIsFlipped] = useState(false);
    const [workingQueue, setWorkingQueue] = useState<number[]>([]);
    const [currentIndexInQueue, setCurrentIndexInQueue] = useState(0);
    const [showTermination, setShowTermination] = useState(false);
    const [lastAction, setLastAction] = useState<'knew' | 'forgot' | null>(null);

    // Dictionary sync
    const lang = language && DICTIONARY[language] ? language : 'en';
    const dict = DICTIONARY[lang];

    // Mastery Tiers Calculation
    const counts = useMemo(() => {
        return cardStates.reduce((acc, card) => {
            const m = card.mastery || 0;
            if (m === 0) acc.Unfamiliar++;
            else if (m === 1) acc.Learning++;
            else if (m === 2) acc.Familiar++;
            else if (m === 3) acc.Mastered++;
            return acc;
        }, { Unfamiliar: 0, Learning: 0, Familiar: 0, Mastered: 0 });
    }, [cardStates]);

    // Initialize or re-sync working queue when cards are loaded/updated
    useEffect(() => {
        if (cardStates.length === 0) return;

        const unmastered = cardStates
            .map((c, i) => (c.mastery! < 3 ? i : -1))
            .filter(i => i !== -1);

        if (unmastered.length > 0) {
            setWorkingQueue(unmastered);
            setCurrentIndexInQueue(0);
            setShowTermination(false);
        } else if (cardStates.length > 0) {
            setShowTermination(true);
        }
    }, [cardStates]);

    const startNewRound = useCallback(() => {
        const unmastered = cardStates
            .map((c, i) => (c.mastery! < 3 ? i : -1))
            .filter(i => i !== -1);

        if (unmastered.length > 0) {
            setWorkingQueue(unmastered);
            setCurrentIndexInQueue(0);
            setShowTermination(false);
            setIsFlipped(false);
        } else {
            setShowTermination(true);
        }
    }, [cardStates]);

    // HANDLERS
    const handleMasteryUpdate = useCallback((knew: boolean) => {
        if (!isFlipped || showTermination || workingQueue.length === 0) return;

        const currentIdx = workingQueue[currentIndexInQueue];
        if (currentIdx === undefined) return;

        const cardId = cardStates[currentIdx].id;
        const feedback = knew ? 'good' : 'forgot';

        // 1. Update LOCAL state
        setCardStates(prev => {
            const next = [...prev];
            const card = { ...next[currentIdx] };
            if (knew) {
                card.mastery = Math.min((card.mastery || 0) + 1, 3);
            } else {
                card.mastery = 0;
            }
            next[currentIdx] = card;
            return next;
        });

        setLastAction(knew ? 'knew' : 'forgot');
        syncMastery(set.id, cardId, feedback);

        setTimeout(() => {
            setIsFlipped(false);
            setLastAction(null);

            if (currentIndexInQueue < workingQueue.length - 1) {
                setCurrentIndexInQueue(prev => prev + 1);
            } else {
                setShowTermination(true);
            }
        }, 400);
    }, [isFlipped, showTermination, currentIndexInQueue, workingQueue, cardStates, set.id, syncMastery]);

    const handleFlip = useCallback(() => {
        if (!showTermination) setIsFlipped(prev => !prev);
    }, [showTermination]);

    const handlePrev = useCallback(() => {
        if (currentIndexInQueue > 0) {
            setIsFlipped(false);
            setCurrentIndexInQueue(prev => prev - 1);
        }
    }, [currentIndexInQueue]);

    const handleNext = useCallback(() => {
        if (currentIndexInQueue < workingQueue.length - 1) {
            setIsFlipped(false);
            setCurrentIndexInQueue(prev => prev + 1);
        }
    }, [currentIndexInQueue, workingQueue.length]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (showTermination) return;
            if (e.code === 'Space') { e.preventDefault(); handleFlip(); }
            if (e.key.toLowerCase() === 'd') handleMasteryUpdate(false);
            if (e.key.toLowerCase() === 'k') handleMasteryUpdate(true);
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleFlip, handleMasteryUpdate, handlePrev, handleNext, showTermination]);

    // Scenario Screens
    if (showTermination && cardStates.length > 0) {
        const isFullyMastered = counts.Mastered === cardStates.length;

        if (isFullyMastered) {
            // Scenario B: Mission Accomplished
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
                            {dict.victoryText}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Concepts Mastered</p>
                            <p className="text-3xl font-black text-white">{counts.Mastered} / {cardStates.length}</p>
                        </div>
                        <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Efficiency Rate</p>
                            <p className="text-3xl font-black text-emerald-400">100%</p>
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
            // Scenario A: Good Progress (Round Complete)
            return (
                <div className="flex flex-col items-center justify-center space-y-12 py-10 min-h-[60vh] animate-slide-up text-center px-6">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-emerald-400">
                            {Math.round((counts.Mastered / cardStates.length) * 100)}%
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase text-emerald-500">Round Complete</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
                            Awesome work! You moved <span className="text-white font-bold">{(cardStates.length - counts.Unfamiliar)}</span> concepts closer to Mastered. Let's tackle the remaining <span className="text-fuchsia-400 font-bold">{cardStates.length - counts.Mastered}</span>!
                        </p>
                    </div>

                    <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            style={{ width: `${(counts.Mastered / cardStates.length) * 100}%` }}
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

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-6 animate-pulse">
                <Sparkle size={64} weight="thin" className="animate-spin text-fuchsia-500" />
                <p className="font-bold italic text-zinc-500">Generating flashcards...</p>
            </div>
        );
    }

    if (genError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                <p className="text-red-500 font-bold">Error: {genError}</p>
                <button onClick={handleGenerate} className="bg-fuchsia-600 text-white px-6 py-2 rounded-xl">Retry</button>
            </div>
        );
    }

    if (cardStates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                <p className="text-zinc-500 font-bold italic">No flashcards found.</p>
                <button onClick={handleGenerate} className="bg-fuchsia-600 text-white px-6 py-2 rounded-xl">Generate Now</button>
            </div>
        );
    }

    const currentCardIdx = workingQueue[currentIndexInQueue];
    const currentCard = cardStates[currentCardIdx];

    if (!currentCard) return null;

    return (
        <div className="w-full flex flex-col items-center space-y-12 animate-slide-up">
            {/* Top Mastery Badges */}
            <div className="flex items-center gap-3 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl">
                <Badge label="Unfamiliar" count={counts.Unfamiliar} type="red" />
                <Badge label="Learning" count={counts.Learning} type="orange" />
                <Badge label="Familiar" count={counts.Familiar} type="blue" />
                <Badge label="Mastered" count={counts.Mastered} type="emerald" />
            </div>

            {/* Flashcard Component */}
            <div className="relative w-full max-w-4xl perspective-2000">
                {lastAction && (
                    <div className="absolute inset-0 z-50 rounded-[48px] flex items-center justify-center animate-fade-out pointer-events-none">
                        {lastAction === 'knew' ? (
                            <div className="bg-emerald-500/20 border-4 border-emerald-500/40 w-full h-full rounded-[48px] flex items-center justify-center">
                                <Check size={160} weight="bold" className="text-emerald-400 opacity-80" />
                            </div>
                        ) : (
                            <div className="bg-red-500/20 border-4 border-red-500/40 w-full h-full rounded-[48px] flex items-center justify-center">
                                <X size={160} weight="bold" className="text-red-400 opacity-80" />
                            </div>
                        )}
                    </div>
                )}

                <div
                    className={`relative h-[500px] w-full cursor-pointer transition-all duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={handleFlip}
                >
                    <div className={`absolute inset-0 backface-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-white/10 rounded-[48px] p-16 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden group/card ${!isFlipped ? 'neon-border-fuchsia border-fuchsia-500/20' : ''}`}>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/5 blur-[120px] rounded-full -z-10 group-hover/card:bg-fuchsia-500/10 transition-all duration-1000" />
                        <div className="absolute top-8 right-8 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            <Keyboard size={14} /> {dict.shortcutSpace}
                        </div>
                        <span className="text-[10px] font-black text-fuchsia-500 uppercase tracking-[0.4em] mb-12 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse shadow-[0_0_10px_#D946EF]" />
                            {dict.neuralProbe}: {currentIndexInQueue + 1} / {workingQueue.length}
                        </span>
                        <div className="text-4xl font-extrabold leading-tight text-white tracking-tight max-w-2xl text-balance group-hover/card:scale-[1.02] transition-transform duration-500">
                            {currentCard.front || currentCard.question}
                        </div>
                        <div className="absolute bottom-12 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{dict.clickToInvert}</div>
                    </div>

                    <div className={`absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-emerald-500/30 rounded-[48px] p-16 flex flex-col items-center justify-center text-center shadow-[0_0_100px_rgba(217,70,239,0.1)] overflow-hidden ${isFlipped ? 'neon-border-emerald' : ''}`}>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                            <Sparkle size={14} weight="fill" className="animate-spin-slow" /> Synthesis Result
                        </span>
                        <div className="text-3xl font-medium text-zinc-100 leading-relaxed overflow-y-auto no-scrollbar max-h-[220px] px-8 text-balance">
                            {currentCard.back || currentCard.answer}
                        </div>
                        <div className="absolute bottom-10 left-10 right-10 flex gap-6" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => handleMasteryUpdate(false)}
                                className="flex-1 group/btn h-20 rounded-[24px] bg-red-500/5 border border-red-500/10 flex items-center justify-center gap-4 hover:bg-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_50px_rgba(239,68,68,0.25)] transition-all active:scale-95 relative"
                            >
                                <X size={24} weight="bold" className="text-red-500 group-hover/btn:scale-125 transition-transform" />
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em]">Forgot</span>
                                    <span className="text-sm font-black text-red-400 uppercase tracking-tighter">{dict.btnForgot}</span>
                                </div>
                                <div className="ml-2 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-black text-zinc-500">D</div>
                            </button>
                            <button
                                onClick={() => handleMasteryUpdate(true)}
                                className="flex-1 group/btn h-20 rounded-[24px] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center gap-4 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_50px_rgba(16,185,129,0.25)] transition-all active:scale-95 relative"
                            >
                                <Check size={24} weight="bold" className="text-emerald-500 group-hover/btn:scale-125 transition-transform" />
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em]">Got it</span>
                                    <span className="text-sm font-black text-emerald-400 uppercase tracking-tighter">{dict.btnKnewIt}</span>
                                </div>
                                <div className="ml-2 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-black text-zinc-500">K</div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-lg flex items-center justify-between px-6 py-4 bg-white/5 border border-white/10 rounded-[32px] shadow-2xl backdrop-blur-md">
                <button
                    onClick={handlePrev}
                    disabled={currentIndexInQueue === 0}
                    className="p-3 rounded-full hover:bg-white/10 transition-all disabled:opacity-20 active:scale-90"
                >
                    <CaretLeft size={24} weight="bold" />
                </button>

                <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Neural Index</span>
                    <span className="text-xl font-bold leading-none flex items-center gap-1.5">
                        <span className="text-white">{currentIndexInQueue + 1}</span>
                        <span className="text-zinc-600 font-medium">/</span>
                        <span className="text-zinc-400">{workingQueue.length}</span>
                    </span>
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentIndexInQueue === workingQueue.length - 1}
                    className="p-3 rounded-full hover:bg-white/10 transition-all disabled:opacity-20 active:scale-90"
                >
                    <CaretRight size={24} weight="bold" />
                </button>
            </div>

            <div className="flex items-center gap-10 opacity-30 hover:opacity-100 transition-opacity pb-10">
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 shadow-inner">SPACE</span> Flip
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 shadow-inner">D</span> Demote
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 shadow-inner">K</span> Promote
                </div>
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
