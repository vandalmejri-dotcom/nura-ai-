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
    Check,
    ArrowRight,
    Sparkle,
    Trash,
    Warning
} from '@phosphor-icons/react';
import { useStudySets, StudySet } from '@/context/StudySetsContext';
import SocraticTutor from '@/components/features/SocraticTutor';
import RawPreviewPane from '@/components/features/RawPreviewPane';
import FlashcardMasteryLoop from '@/components/features/FlashcardMasteryLoop';
import QuizArena from '@/components/features/QuizArena';
import FillInTheBlanks from '@/components/features/FillInTheBlanks';
import AISynthesis from '@/components/features/AISynthesis';
import ReactMarkdown from 'react-markdown';

type Tab = 'notes' | 'synthesis' | 'flashcards' | 'quiz' | 'podcast' | 'tutor' | 'fillInTheBlanks';

export default function StudySetDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { sets, updateSet, deleteSet, loading } = useStudySets();
    const [set, setSet] = useState<StudySet | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('synthesis');
    const [mounted, setMounted] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!loading && sets.length > 0) {
            const found = sets.find(s => s.id === id);
            if (found) setSet(found);
        }
    }, [id, sets, loading]);

    useEffect(() => {
        if (set?.title) {
            document.title = `${set.title} | Nura AI`;
        }
    }, [set?.title]);

    const tabs = React.useMemo(() => [
        { id: 'synthesis', label: 'AI Synthesis', icon: Sparkle, disabled: false },
        { id: 'notes', label: 'Raw Input', icon: FileText, disabled: false },
        { id: 'flashcards', label: 'Flashcards', icon: Cards, disabled: false },
        { id: 'quiz', label: 'Quiz Arena', icon: Exam, disabled: false },
        { id: 'fillInTheBlanks', label: 'Fill in the Blanks', icon: FileText, disabled: false },
        { id: 'podcast', label: 'Podcast', icon: SpeakerHigh, disabled: false },
        { id: 'tutor', label: 'AI Tutor', icon: ChatTeardropDots, disabled: false },
    ], [set, activeTab]);

    // Select the first enabled tab if the current one is disabled or not set
    useEffect(() => {
        if (set) {
            const currentTab = tabs.find(t => t.id === activeTab);
            if (!currentTab) {
                setActiveTab('synthesis');
            }
        }
    }, [set, tabs, activeTab]);

    const handleGenerate = async (type: Tab) => {
        if (!set || !set.rawContent || isGenerating) return;
        
        setIsGenerating(true);
        try {
            const endpoint = 
                type === 'flashcards' ? '/api/generate/flashcards' :
                type === 'quiz' ? '/api/generate/quiz' :
                type === 'synthesis' ? '/api/generate/synthesis' :
                type === 'fillInTheBlanks' ? '/api/generate/fib' :
                null;
            
            if (!endpoint) return;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setId: set.id, language: set.detectedLanguage || 'en' })
            });

            if (!res.ok) throw new Error("Generation failed");
            
            const result = await res.json();
            if (result.success) {
                const updates: Partial<StudySet> = {};
                if (type === 'flashcards') updates.flashcards = result.data;
                if (type === 'quiz') updates.quiz = result.data;
                if (type === 'synthesis') updates.synthesizedNotes = result.data;
                if (type === 'fillInTheBlanks') updates.fillInTheBlanks = result.data;

                // Update stats
                const newStats = { ...(set.stats || { wordCount: 0, characterCount: 0, cardCount: 0, quizCount: 0, fibCount: 0 }) };
                if (type === 'flashcards') newStats.cardCount = result.data.length;
                if (type === 'quiz') newStats.quizCount = result.data.length;
                if (type === 'fillInTheBlanks') newStats.fibCount = result.data.length;
                updates.stats = newStats;

                updateSet(set.id, updates);
            }
        } catch (error) {
            console.error("Lazy Generation Error:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!mounted || loading) return <div className="animate-pulse glass-dark h-screen rounded-3xl" />;
    if (!set) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <h2 className="text-2xl font-bold">Mission Data Not Found</h2>
            <button onClick={() => router.push('/')} className="text-fuchsia-500 font-bold flex items-center gap-2">
                <ArrowLeft weight="bold" /> Back to Dashboard
            </button>
        </div>
    );

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
            <div className="flex items-center gap-1.5 p-1.5 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/5 w-fit shadow-2xl">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        disabled={tab.disabled}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-widest ${activeTab === tab.id
                            ? 'bg-gradient-to-br from-fuchsia-500/20 to-violet-500/10 text-fuchsia-400 border border-fuchsia-500/20 shadow-[0_0_20px_rgba(217,70,239,0.15)]'
                            : tab.disabled ? 'opacity-20 cursor-not-allowed' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                    >
                        <tab.icon size={18} weight={activeTab === tab.id ? 'fill' : 'bold'} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Dynamic Content Area */}
            <div className="glass-dark rounded-3xl min-h-[60vh] p-10 border-white/5 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/5 blur-[120px] rounded-full -z-10" />

                {activeTab === 'synthesis' && (
                    <div className="space-y-8 animate-fade-in w-full">
                        {set.synthesizedNotes ? (
                            <AISynthesis data={set.synthesizedNotes} />
                        ) : (
                            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-16 lg:p-24 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent opacity-30" />
                                <LazyPlaceholder 
                                    type="synthesis" 
                                    isGenerating={isGenerating} 
                                    onGenerate={() => handleGenerate('synthesis')} 
                                    icon={<Sparkle size={48} weight="thin" />}
                                    label="AI Synthesis"
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="space-y-8 animate-slide-up">
                        <RawPreviewPane
                            sourceUrl={set.sourceUrl}
                            rawContent={set.rawContent || set.sourceContent}
                            rawContentType={set.rawContentType}
                            fileName={set.sourceName}
                        />
                    </div>
                )}

                {activeTab === 'flashcards' && (
                    <div className="flex flex-col items-center justify-center py-10 w-full">
                        <FlashcardMasteryLoop
                            set={set}
                            language={set.detectedLanguage || 'en'}
                        />
                    </div>
                )}

                {activeTab === 'quiz' && (
                    <div className="h-full animate-slide-up w-full flex flex-col items-center justify-center">
                        {set.quiz && set.quiz.length > 0 ? (
                            <QuizArena quiz={set.quiz || []} set={set} />
                        ) : (
                            <LazyPlaceholder 
                                type="quiz" 
                                isGenerating={isGenerating} 
                                onGenerate={() => handleGenerate('quiz')} 
                                icon={<Exam size={48} weight="thin" />}
                                label="Quiz Arena"
                            />
                        )}
                    </div>
                )}

                {activeTab === 'fillInTheBlanks' as Tab && (
                    <div className="h-full animate-slide-up w-full flex flex-col items-center justify-center">
                        {set.fillInTheBlanks && set.fillInTheBlanks.length > 0 ? (
                            <FillInTheBlanks
                                questions={set.fillInTheBlanks || []}
                                setId={set.id}
                                language={set.detectedLanguage || 'en'}
                            />
                        ) : (
                            <LazyPlaceholder 
                                type="fillInTheBlanks" 
                                isGenerating={isGenerating} 
                                onGenerate={() => handleGenerate('fillInTheBlanks')} 
                                icon={<FileText size={48} weight="thin" />}
                                label="Fill in the Blanks"
                            />
                        )}
                    </div>
                )}

                {activeTab === 'podcast' && (
                    <div className="prose prose-invert max-w-none animate-slide-up">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <SpeakerHigh weight="bold" size={24} />
                            </div>
                            <h2 className="text-2xl font-bold m-0 italic text-gradient">AI Podcast Script <span className="text-zinc-400 text-sm font-normal not-italic ml-2">(Conversational Learning)</span></h2>
                        </div>
                        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[40px] p-12 shadow-2xl relative overflow-hidden">
                            <div className="prose prose-invert max-w-none leading-relaxed">
                                <ReactMarkdown>
                                    {set.podcast || "No podcast script generated for this mission."}
                                </ReactMarkdown>
                            </div>
                        </div>
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

function LazyPlaceholder({ type, isGenerating, onGenerate, icon, label }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-6">
            <div className={`${isGenerating ? 'animate-spin' : ''}`}>
                {icon}
            </div>
            <div className="text-center space-y-2">
                <p className="font-bold italic text-zinc-500">
                    {isGenerating ? `Generating ${label}...` : `${label} not yet generated.`}
                </p>
                <p className="text-sm opacity-50 max-w-xs mx-auto">
                    {isGenerating 
                        ? "Nura AI is extracting concepts and building your mission materials." 
                        : `Launch the generation to create high-performance ${label.toLowerCase()} from your materials.`}
                </p>
            </div>
            {!isGenerating && (
                <button 
                    onClick={onGenerate}
                    className="flex items-center gap-2 bg-fuchsia-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-xl hover:bg-fuchsia-500 transition-all active:scale-95"
                >
                    <Sparkle size={18} weight="bold" /> Generate {label}
                </button>
            )}
        </div>
    );
}

