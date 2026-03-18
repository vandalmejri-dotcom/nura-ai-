'use client';

import React, { useState } from 'react';
import { 
    Brain, 
    Lightning, 
    Warning, 
    CheckCircle, 
    Medal, 
    CaretDown, 
    Lightbulb,
    Info,
    Check
} from '@phosphor-icons/react';

interface Concept {
    concept: string;
    definition: string;
    whyItMatters: string;
    example: string;
}

interface Section {
    emoji: string;
    title: string;
    content: string;
    bulletPoints: string[];
    examTip: string;
}

interface Mistake {
    mistake: string;
    correction: string;
}

interface ExamQuestion {
    question: string;
    answer: string;
}

interface MemoryAid {
    item: string;
    aid: string;
}

interface SynthesisData {
    title: string;
    examReadinessScore: number;
    tldr: string;
    keyConcepts: Concept[];
    mainSections: Section[];
    criticalFacts: string[];
    commonMistakes: Mistake[];
    examQuestions: ExamQuestion[];
    memoryAids: MemoryAid[];
    summary: string;
}

interface AISynthesisProps {
    data: string | SynthesisData;
}

const AISynthesis: React.FC<AISynthesisProps> = ({ data }) => {
    let notes: SynthesisData;
    
    try {
        notes = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        return (
            <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
                <p className="font-bold flex items-center gap-2 mb-2">
                    <Warning size={20} weight="bold" /> Error Parsing Synthesis
                </p>
                <p className="text-sm opacity-80">The AI output format was incorrect. Please try regenerating.</p>
            </div>
        );
    }

    if (!notes || !notes.title) return null;

    return (
        <div className="space-y-12 animate-slide-up pb-10">
            {/* 1. HEADER SECTION */}
            <div className="space-y-8">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                        {notes.title}
                    </h1>
                    <div className="flex flex-col gap-2 max-w-md pt-4">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-zinc-500">
                            <span>Exam Readiness</span>
                            <span className="text-fuchsia-500">{notes.examReadinessScore}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="h-full bg-linear-to-r from-fuchsia-600 to-violet-600 shadow-[0_0_15px_rgba(217,70,239,0.15)] transition-all duration-1000"
                                style={{ width: `${notes.examReadinessScore}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-linear-to-br from-violet-500/10 to-fuchsia-500/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-fuchsia-500/10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                        <Brain size={80} weight="duotone" />
                    </div>
                    <div className="relative z-10 flex gap-6 items-start text-left">
                        <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center text-violet-400 shrink-0">
                            <Brain size={28} weight="fill" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-widest text-violet-400">Executive Summary (TL;DR)</h3>
                            <p className="text-lg md:text-xl text-zinc-100 font-medium leading-relaxed italic">
                                "{notes.tldr}"
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. KEY CONCEPTS */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                        <Medal size={20} weight="bold" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-100 italic">Key Concepts</h2>
                </div>
                <div className="grid gap-4">
                    {notes.keyConcepts.map((concept, idx) => (
                        <ExpandableConceptCard key={idx} concept={concept} />
                    ))}
                </div>
            </section>

            {/* 3. MAIN SECTIONS */}
            <section className="space-y-8">
                {notes.mainSections.map((section, idx) => (
                    <div key={idx} className="bg-black/40 backdrop-blur-md border border-white/5 rounded-[40px] overflow-hidden">
                        <div className="px-8 md:px-12 py-10 md:py-16 space-y-8">
                            <div className="flex items-center gap-4">
                                <span className="text-4xl">{section.emoji}</span>
                                <h3 className="text-3xl font-black tracking-tight text-white">{section.title}</h3>
                            </div>
                            
                            <p className="text-lg text-zinc-300 leading-relaxed font-medium">
                                {section.content}
                            </p>

                            <div className="grid gap-4">
                                {section.bulletPoints.map((point, pIdx) => (
                                    <div key={pIdx} className="flex gap-4 group">
                                        <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 mt-2.5 shrink-0 group-hover:scale-150 transition-transform" />
                                        <span className="text-zinc-400 font-medium leading-relaxed">{point}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-white/5">
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
                                    <span className="text-2xl mt-0.5">📝</span>
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-500/80">Exam Tip</h4>
                                        <p className="text-zinc-200 font-bold leading-relaxed">{section.examTip}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* 4. CRITICAL FACTS */}
            <section className="bg-linear-to-br from-zinc-900 to-black border border-white/5 rounded-[40px] p-10 md:p-14 space-y-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                        <Lightning size={24} weight="fill" />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-fuchsia-400">Critical Facts (Must Know)</h2>
                </div>
                
                <div className="space-y-6 relative z-10">
                    {notes.criticalFacts.map((fact, idx) => (
                        <div key={idx} className="flex gap-6 items-start group">
                            <div className="p-3 bg-zinc-800/50 rounded-lg text-fuchsia-500/60 font-black text-xl italic tabular-nums group-hover:text-fuchsia-500 transition-colors">
                                ⚡
                            </div>
                            <p className="text-xl text-zinc-300 font-medium leading-relaxed pt-1">
                                {fact.split(/(\*\*[^*]+\*\*)/g).map((part, i) => 
                                    part.startsWith('**') && part.endsWith('**') 
                                        ? <strong key={i} className="text-white font-black drop-shadow-sm">{part.slice(2, -2)}</strong> 
                                        : part
                                )}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 5. COMMON MISTAKES */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
                        <Warning size={20} weight="fill" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-100 italic">Pitfalls & Corrections</h2>
                </div>
                
                <div className="grid gap-4">
                    {notes.commonMistakes.map((m, idx) => (
                        <div key={idx} className="grid md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                            <div className="bg-red-500/5 p-6 flex gap-4">
                                <span className="text-red-500 shrink-0 text-xl">❌</span>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500/60 font-mono">Mistake</span>
                                    <p className="text-zinc-300 font-medium leading-snug">{m.mistake}</p>
                                </div>
                            </div>
                            <div className="bg-green-500/5 p-6 flex gap-4">
                                <span className="text-green-500 shrink-0 text-xl">✅</span>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-500/60 font-mono">Correction</span>
                                    <p className="text-zinc-100 font-bold leading-snug">{m.correction}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. EXAM QUESTIONS */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <CheckCircle size={20} weight="bold" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-100 italic">Predictive Exam Practice</h2>
                </div>

                <div className="space-y-4">
                    {notes.examQuestions.map((q, idx) => (
                        <ExamQuestionCard key={idx} question={q} />
                    ))}
                </div>
            </section>

            {/* 7. MEMORY AIDS */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
                        <Lightbulb size={20} weight="bold" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-100 italic">Retention Hacks</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {notes.memoryAids.map((aid, idx) => (
                        <div key={idx} className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-4 hover:bg-white/[0.05] transition-all flex flex-col justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Remember:</span>
                                <span className="text-zinc-100 font-bold leading-tight">{aid.item}</span>
                            </div>
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-fuchsia-400 font-semibold italic text-sm leading-relaxed">
                                    "{aid.aid}"
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 8. SUMMARY */}
            <section className="pt-8">
                <div className="bg-linear-to-br from-zinc-900 to-black border border-white/5 rounded-[48px] p-12 md:p-16 relative overflow-hidden text-center shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-violet-500/10 via-transparent to-transparent pointer-events-none" />
                    <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                        <h3 className="text-2xl font-black text-white italic">Holistic Summary</h3>
                        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed font-medium">
                            {notes.summary}
                        </p>
                        <div className="flex justify-center pt-8">
                            <div className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10 flex items-center gap-3">
                                <CheckCircle size={24} weight="fill" className="text-green-500" />
                                <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Unit Mastered</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

const ExpandableConceptCard: React.FC<{ concept: Concept }> = ({ concept }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div 
            className={`transition-all duration-500 rounded-3xl border ${isOpen ? 'bg-violet-500/10 border-violet-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.3)]' : 'bg-white/5 border-white/5 hover:bg-white/[0.08]'}`}
        >
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left p-6 md:p-8 flex items-center justify-between gap-6"
            >
                <div className="space-y-2">
                    <h4 className="text-xl font-bold text-white group-hover:text-violet-400">{concept.concept}</h4>
                    <p className="text-zinc-400 font-medium leading-relaxed">{concept.definition}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 transition-transform duration-500 ${isOpen ? 'rotate-180 bg-violet-500 text-white' : 'text-zinc-500'}`}>
                    <CaretDown size={20} weight="bold" />
                </div>
            </button>
            
            {isOpen && (
                <div className="px-8 pb-8 space-y-6 animate-fade-in">
                    <div className="h-px bg-white/5" />
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-violet-400">Why It Matters</h5>
                            <p className="text-zinc-300 leading-relaxed font-medium capitalize">{concept.whyItMatters}</p>
                        </div>
                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Real-World Case</h5>
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <p className="text-zinc-400 text-sm italic font-medium leading-relaxed">
                                    "{concept.example}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ExamQuestionCard: React.FC<{ question: ExamQuestion }> = ({ question }) => {
    const [isRevealed, setIsRevealed] = useState(false);

    return (
        <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 md:p-8 space-y-6">
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 font-bold text-sm">
                        Q
                    </div>
                    <p className="text-lg text-zinc-200 font-bold leading-snug pt-1">
                        {question.question}
                    </p>
                </div>

                <div className="relative group">
                    {!isRevealed ? (
                        <button 
                            onClick={() => setIsRevealed(true)}
                            className="w-full py-12 bg-black/40 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-black/60 hover:border-violet-500/50 transition-all group-hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                        >
                            <Info size={32} className="text-zinc-600 group-hover:text-violet-400 transition-colors" />
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Click to reveal model answer</span>
                        </button>
                    ) : (
                        <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-8 flex gap-6 animate-slide-up relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 blur-2xl rounded-full" />
                            <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-lg shadow-violet-500/20 relative z-10">
                                <Check size={24} weight="bold" />
                            </div>
                            <div className="space-y-4 w-full relative z-10">
                                <p className="text-zinc-100 font-medium leading-relaxed text-lg">{question.answer}</p>
                                <button 
                                    onClick={() => setIsRevealed(false)}
                                    className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-zinc-400 flex items-center gap-2"
                                >
                                    Hide Answer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AISynthesis;
