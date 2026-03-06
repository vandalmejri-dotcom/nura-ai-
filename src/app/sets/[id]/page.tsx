'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Books,
    Layout,
    Cards,
    Exam,
    ChatTeardropDots,
    SpeakerHigh,
    FileText,
    Clock,
    Sparkle,
    Trash,
    Warning,
    Check,
    ArrowRight
} from '@phosphor-icons/react';
import { useStudySets, StudySet } from '@/context/StudySetsContext';
import SocraticTutor from '@/components/features/SocraticTutor';

type Tab = 'notes' | 'flashcards' | 'quiz' | 'podcast' | 'tutor';

export default function StudySetDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { sets, deleteSet, loading } = useStudySets();
    const [set, setSet] = useState<StudySet | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('notes');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!loading && sets.length > 0) {
            const found = sets.find(s => s.id === id);
            if (found) setSet(found);
        }
    }, [id, sets, loading]);

    if (!mounted || loading) return <div className="animate-pulse glass-dark h-screen rounded-3xl" />;
    if (!set) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <h2 className="text-2xl font-bold">Mission Data Not Found</h2>
            <button onClick={() => router.push('/')} className="text-fuchsia-500 font-bold flex items-center gap-2">
                <ArrowLeft weight="bold" /> Back to Dashboard
            </button>
        </div>
    );

    const tabs = [
        { id: 'notes', label: 'Cornell Notes', icon: FileText, disabled: !set.notes },
        { id: 'flashcards', label: 'Flashcards', icon: Cards, disabled: !set.flashcards },
        { id: 'quiz', label: 'Quiz Arena', icon: Exam, disabled: !set.quiz },
        { id: 'podcast', label: 'Podcast', icon: SpeakerHigh, disabled: !set.podcast },
        { id: 'tutor', label: 'AI Tutor', icon: ChatTeardropDots, disabled: false },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                    >
                        <ArrowLeft weight="bold" /> Dashboard
                    </button>
                    <div className="space-y-1">
                        <h1 className="text-4xl font-extrabold tracking-tight">{set.title}</h1>
                        <div className="flex items-center gap-3 text-sm text-zinc-500 font-medium">
                            <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tighter">
                                <Books size={14} /> {set.sourceName}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock size={14} /> {new Date(set.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { deleteSet(set.id); router.push('/'); }}
                        className="p-3 rounded-2xl bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all border border-red-500/10"
                    >
                        <Trash size={20} />
                    </button>
                    <button className="flex items-center gap-2 bg-zinc-100 text-black px-6 py-3 rounded-2xl font-bold text-sm shadow-xl hover:bg-white transition-all active:scale-95">
                        <SpeakerHigh size={18} weight="bold" /> High-Performance Mode
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1.5 glass-dark rounded-2xl border-white/5 w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        disabled={tab.disabled}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === tab.id
                            ? 'bg-white/10 text-fuchsia-400'
                            : tab.disabled ? 'opacity-30 cursor-not-allowed' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <tab.icon size={20} weight={activeTab === tab.id ? 'fill' : 'regular'} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Dynamic Content Area */}
            <div className="glass-dark rounded-3xl min-h-[60vh] p-10 border-white/5 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/5 blur-[120px] rounded-full -z-10" />

                {activeTab === 'notes' && (
                    <div className="prose prose-invert max-w-none space-y-8 animate-slide-up">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                                <FileText weight="bold" size={24} />
                            </div>
                            <h2 className="text-2xl font-bold m-0 italic">Mission <span className="text-gradient">Briefing</span></h2>
                        </div>
                        <div className="text-zinc-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {set.notes}
                        </div>
                    </div>
                )}

                {activeTab === 'flashcards' && (
                    <div className="h-full flex flex-col items-center justify-center animate-slide-up pt-10">
                        <FlashcardPlayer cards={set.flashcards || []} />
                    </div>
                )}

                {activeTab === 'quiz' && (
                    <div className="h-full animate-slide-up">
                        <QuizArena quiz={set.quiz || []} />
                    </div>
                )}

                {activeTab === 'tutor' && (
                    <div className="h-full animate-slide-up">
                        <SocraticTutor
                            sourceContent={set.sourceContent || set.notes || ''}
                            sourceName={set.sourceName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* Sub-components for players */
function FlashcardPlayer({ cards }: { cards: any[] }) {
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (!cards.length) return <div>No cards generated for this mission.</div>;

    const current = cards[index];

    return (
        <div className="w-full max-w-2xl space-y-10">
            <div
                className="relative h-96 w-full cursor-pointer perspective-1000 group"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden glass-dark border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-6">Question {index + 1}/{cards.length}</span>
                        <div className="text-2xl font-bold leading-tight text-white">{current.front || current.question}</div>
                        <div className="absolute bottom-10 text-xs text-zinc-500 italic opacity-0 group-hover:opacity-100 transition-opacity">Click to Reveal Synthesis</div>
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 glass border-fuchsia-500/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-6 italic">Synthesized Insight</span>
                        <div className="text-xl font-medium text-zinc-100 leading-relaxed">{current.back || current.answer}</div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center gap-6">
                <button
                    disabled={index === 0}
                    onClick={() => { setIndex(index - 1); setIsFlipped(false); }}
                    className="p-4 rounded-full glass hover:bg-white/10 text-zinc-400 disabled:opacity-20 translate-all"
                >
                    <ArrowLeft size={24} weight="bold" />
                </button>
                <div className="font-bold text-zinc-600 uppercase tracking-widest text-xs">
                    Mastery Progress: {Math.round(((index + 1) / cards.length) * 100)}%
                </div>
                <button
                    disabled={index === cards.length - 1}
                    onClick={() => { setIndex(index + 1); setIsFlipped(false); }}
                    className="p-4 rounded-full glass hover:bg-white/10 text-zinc-400 disabled:opacity-20 transition-all"
                >
                    <ArrowLeft size={24} weight="bold" className="rotate-180" />
                </button>
            </div>
        </div>
    );
}

function QuizArena({ quiz }: { quiz: any[] }) {
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [finished, setFinished] = useState(false);

    if (!quiz.length) return <div>No quiz data for this mission.</div>;
    if (finished) return (
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-6 text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Sparkle size={48} weight="fill" />
            </div>
            <div>
                <h3 className="text-3xl font-extrabold">Mission Success</h3>
                <p className="text-zinc-500">You scored {score}/{quiz.length} in the Arena.</p>
            </div>
            <button onClick={() => { setIndex(0); setScore(0); setFinished(false); }} className="px-8 py-3 rounded-2xl bg-zinc-100 text-black font-bold">Restart Arena</button>
        </div>
    );

    const current = quiz[index];

    const handleSelect = (idx: number) => {
        if (selected !== null) return;
        setSelected(idx);
        const correct = idx === current.correctAnswerIndex;
        setIsCorrect(correct);
        if (correct) setScore(score + 1);
    };

    const next = () => {
        if (index === quiz.length - 1) {
            setFinished(true);
        } else {
            setIndex(index + 1);
            setSelected(null);
            setIsCorrect(null);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-10 py-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Bloom's Taxonomy Level: {current.level || 'Deep Analysis'}</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Question {index + 1}/{quiz.length}</span>
                </div>
                <h3 className="text-2xl font-bold leading-tight">{current.question}</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {current.options.map((opt: string, i: number) => (
                    <button
                        key={i}
                        onClick={() => handleSelect(i)}
                        className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${selected === i
                            ? (isCorrect ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200' : 'bg-red-500/10 border-red-500/50 text-red-200')
                            : selected !== null && i === current.correctAnswerIndex
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200'
                                : 'bg-white/5 border-white/5 hover:border-white/20 text-zinc-400'
                            }`}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${selected === i ? 'bg-white/10' : 'bg-zinc-800 group-hover:bg-zinc-700'
                                }`}>
                                {String.fromCharCode(65 + i)}
                            </div>
                            {opt}
                        </div>
                        {selected === i && isCorrect === false && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-red-500 animate-pulse">
                                <Warning size={24} weight="fill" />
                            </div>
                        )}
                        {((selected === i && isCorrect) || (selected !== null && i === current.correctAnswerIndex)) && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500 animate-bounce">
                                <Check size={24} weight="bold" />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {selected !== null && (
                <div className="flex flex-col items-center space-y-6 pt-4 animate-slide-up">
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-zinc-300 italic text-center w-full">
                        <span className="font-bold text-zinc-500 block mb-2 uppercase tracking-widest text-[10px]">Scientific Rationale</span>
                        {current.rationale || "The correct physiological response relies on the structural integrity of the human's architectural instruction."}
                    </div>
                    <button onClick={next} className="w-full py-5 rounded-2xl bg-zinc-100 text-black font-extrabold text-lg hover:bg-white transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]">
                        {index === quiz.length - 1 ? 'Finalize Mission' : 'Advance to Next Phase'} <ArrowRight weight="bold" />
                    </button>
                </div>
            )}
        </div>
    );
}
