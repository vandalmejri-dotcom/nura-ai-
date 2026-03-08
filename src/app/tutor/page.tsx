'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChatTeardropDots, PaperPlaneRight, Sparkle, Target } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export default function TutorPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<{ role: string, text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Initial greeting load
    useEffect(() => {
        const initChat = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/tutor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [] })
                });
                const data = await res.json();
                if (data.success) {
                    setMessages([{ role: 'assistant', text: data.data.text }]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
                setInitialized(true);
            }
        };
        if (!initialized) initChat();
    }, [initialized]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const newMessages = [...messages, { role: 'user', text: input }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages })
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => [...prev, { role: 'assistant', text: data.data.text }]);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col pt-4 pb-8 space-y-6 animate-slide-up">
            <div className="flex items-center justify-between shrink-0">
                <div className="space-y-1">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-4"
                    >
                        <ArrowLeft weight="bold" /> Dashboard
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                            <ChatTeardropDots size={24} weight="fill" />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Proactive AI Tutor</h1>
                    </div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <Target size={16} className="text-red-400" />
                    <span className="text-xs font-bold text-zinc-400">Targeting: Unfamiliar Concepts</span>
                </div>
            </div>

            <div className="flex-1 glass-dark rounded-3xl border-white/5 p-6 overflow-hidden flex flex-col relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-6 relative z-10">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${m.role === 'user'
                                ? 'bg-zinc-800 text-white font-bold text-xs'
                                : 'bg-linear-to-tr from-fuchsia-600 to-violet-600 shadow-xl shadow-fuchsia-500/20 text-white'
                                }`}>
                                {m.role === 'user' ? 'W' : <Sparkle size={16} weight="fill" />}
                            </div>
                            <div className={`p-5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                                ? 'bg-white/10 text-white'
                                : 'bg-black/50 border border-white/5 text-zinc-300'
                                }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-4 w-fit">
                            <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-linear-to-tr from-fuchsia-600 to-violet-600 shadow-xl text-white animate-pulse">
                                <Sparkle size={16} weight="fill" />
                            </div>
                            <div className="px-5 py-4 rounded-3xl bg-black/50 border border-white/5 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" />
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce delay-100" />
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce delay-200" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative z-10 shrink-0">
                    <div className="relative flex items-center">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Message the Tutor..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-sm text-zinc-100 focus-within:border-violet-500/50 outline-none transition-all placeholder:text-zinc-600"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="absolute right-2 p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 transition-all shadow-lg"
                        >
                            <PaperPlaneRight size={18} weight="fill" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
