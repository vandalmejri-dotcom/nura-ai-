'use client';
import React from 'react';
import { ArrowLeft, ChartLineUp, Brain, TrendUp, Database } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export default function ProgressPage() {
    const router = useRouter();

    // Mock data representing the Mastery State Machine aggregation
    const stats = {
        totalArtifacts: 245,
        unfamiliar: 45,
        learning: 85,
        familiar: 75,
        mastered: 40
    };

    const getWidth = (val: number) => `${Math.round((val / stats.totalArtifacts) * 100)}%`;

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-slide-up space-y-10">
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
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                                <ChartLineUp size={24} weight="bold" />
                            </div>
                            <h1 className="text-4xl font-extrabold tracking-tight">Mastery Analytics</h1>
                        </div>
                        <p className="text-zinc-500 max-w-xl text-lg">
                            Monitor your cognitive retention. The Spaced Repetition Engine classifies every concept to guarantee long-term memory transfer.
                        </p>
                    </div>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl glass-dark border-white/5 space-y-4 hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><Database size={24} className="text-zinc-400" /></div>
                    <div>
                        <div className="text-4xl font-black text-white">{stats.totalArtifacts}</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Total Artifacts Tracked</div>
                    </div>
                </div>
                <div className="p-6 rounded-3xl glass-dark border-white/5 space-y-4 hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 flex items-center justify-center"><Brain size={24} className="text-fuchsia-500" /></div>
                    <div>
                        <div className="text-4xl font-black text-fuchsia-400">{Math.round((stats.mastered / stats.totalArtifacts) * 100)}%</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Global Retention Score</div>
                    </div>
                </div>
                <div className="p-6 rounded-3xl glass-dark border-white/5 space-y-4 hover:bg-white/5 transition-all relative overflow-hidden">
                    <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendUp size={24} className="text-emerald-500" /></div>
                    <div>
                        <div className="text-4xl font-black text-emerald-400">+12%</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Weekly Improvement</div>
                    </div>
                </div>
            </div>

            {/* Mastery Pipeline Chart */}
            <div className="p-10 rounded-3xl glass-dark border-white/5 space-y-8 relative overflow-hidden">
                <div className="space-y-2 relative z-10">
                    <h3 className="text-xl font-bold">Concept Pipeline</h3>
                    <p className="text-zinc-500 text-sm">Distribution of flashcards and terms across cognitive states.</p>
                </div>

                <div className="space-y-6 relative z-10">
                    <ProgressBar label="Unfamiliar (0)" count={stats.unfamiliar} width={getWidth(stats.unfamiliar)} color="bg-red-500" text="text-red-500" />
                    <ProgressBar label="Learning (1)" count={stats.learning} width={getWidth(stats.learning)} color="bg-orange-500" text="text-orange-500" />
                    <ProgressBar label="Familiar (2)" count={stats.familiar} width={getWidth(stats.familiar)} color="bg-blue-500" text="text-blue-500" />
                    <ProgressBar label="Mastered (3)" count={stats.mastered} width={getWidth(stats.mastered)} color="bg-emerald-500" text="text-emerald-500" />
                </div>
            </div>
        </div>
    );
}

function ProgressBar({ label, count, width, color, text }: { label: string, count: number, width: string, color: string, text: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-40 text-sm font-bold text-zinc-400">{label}</div>
            <div className="flex-1 h-8 bg-white/[0.03] rounded-xl overflow-hidden shadow-inner flex items-center">
                <div className={`h-full ${color} transition-all duration-1000 ease-out flex items-center justify-end px-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]`} style={{ width }}>
                    <span className="text-[10px] font-black tracking-widest text-black/50 mix-blend-overlay">{count} Items</span>
                </div>
            </div>
            <div className={`w-12 text-right font-black ${text}`}>{count}</div>
        </div>
    );
}
