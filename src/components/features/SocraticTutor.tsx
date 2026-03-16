'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    PaperPlaneRight,
    Brain,
    User,
    CircleNotch,
    Sparkle,
    ArrowClockwise
} from '@phosphor-icons/react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface SocraticTutorProps {
    sourceContent: string;
    sourceName: string;
}

export default function SocraticTutor({ sourceContent, sourceName }: SocraticTutorProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: `I've analyzed "${sourceName}". Let's start our dialogue. How would you explain the core concept of this material in your own words?`
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    context: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n'),
                    sourceContent: sourceContent.substring(0, 10000) // Limit context size
                }),
            });

            const data = await response.json();

            if (data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: "My neural link is flickering. Could you repeat that or try a different angle?" }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Connectivity lost. Ensure your mission control is stable." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[75vh] bg-black/40 backdrop-blur-2xl rounded-[40px] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent opacity-30" />

            {/* Mission HUD Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/30 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(192,38,211,0.2)] border border-white/20">
                        <Brain size={28} weight="fill" />
                    </div>
                    <div>
                        <h3 className="font-black italic tracking-tighter uppercase text-xl text-zinc-100">Socratic Neural Link</h3>
                        <div className="flex items-center gap-3">
                            <p className="text-[10px] text-fuchsia-400 uppercase tracking-[0.4em] font-black flex items-center gap-1.5 bg-fuchsia-500/10 px-3 py-1 rounded-full border border-fuchsia-500/20">
                                <Sparkle size={10} weight="fill" className="animate-pulse" /> Active Dialogue
                            </p>
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{sourceName}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setMessages([messages[0]])}
                    className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-90 border border-white/5 shadow-inner"
                >
                    <ArrowClockwise size={20} weight="bold" />
                </button>
            </div>

            {/* Neural Matrix Stream (Messages) */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar scroll-smooth">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                        <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border transition-all duration-500 ${msg.role === 'user'
                                ? 'bg-zinc-900 border-white/5 text-zinc-400 shadow-inner'
                                : 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.1)]'
                                }`}>
                                {msg.role === 'user' ? <User size={20} weight="bold" /> : <Brain size={20} weight="fill" />}
                            </div>
                            <div className={`p-6 rounded-[32px] text-base leading-relaxed tracking-tight ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white rounded-tr-none shadow-xl'
                                : 'bg-white/5 text-zinc-200 border border-white/10 rounded-tl-none backdrop-blur-sm'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="flex gap-4 items-center">
                            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.1)]">
                                <CircleNotch size={20} className="animate-spin" />
                            </div>
                            <div className="bg-white/5 border border-white/5 px-6 py-4 rounded-full text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] italic">
                                Deciphering Neural Patterns...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Tactical Input Interface */}
            <div className="p-8 bg-black/40 backdrop-blur-3xl border-t border-white/10 relative">
                <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-4">
                    <div className="absolute left-6 text-fuchsia-500 opacity-40">
                        <Sparkle size={18} weight="fill" />
                    </div>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="INPUT NEURAL COMMAND..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-[28px] py-5 pl-14 pr-20 text-sm font-bold tracking-widest text-white outline-none focus:border-fuchsia-500/50 transition-all focus:bg-white/[0.05] shadow-inner placeholder:text-zinc-700"
                    />
                    <button
                        disabled={!input.trim() || isLoading}
                        onClick={handleSend}
                        className="absolute right-2 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white disabled:opacity-20 transition-all hover:scale-[1.05] active:scale-95 shadow-[0_10px_30px_rgba(192,38,211,0.3)] border border-white/20 active:shadow-none group"
                    >
                        <PaperPlaneRight size={24} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
