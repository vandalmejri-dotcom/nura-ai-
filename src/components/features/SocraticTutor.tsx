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
        <div className="flex flex-col h-full max-h-[70vh] glass rounded-3xl overflow-hidden border-white/10 shadow-2xl relative">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-fuchsia-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/20">
                        <Brain size={24} weight="fill" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100">Socratic Instructor</h3>
                        <p className="text-[10px] text-fuchsia-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
                            <Sparkle size={10} weight="fill" /> Active Recall Mode
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setMessages([messages[0]])}
                    className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                    <ArrowClockwise size={20} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-400' : 'bg-fuchsia-500/10 text-fuchsia-400'
                                }`}>
                                {msg.role === 'user' ? <User size={18} /> : <Brain size={18} weight="fill" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-fuchsia-600 text-white rounded-tr-none'
                                    : 'bg-white/5 text-zinc-300 border border-white/5 rounded-tl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="flex gap-3 max-w-[85%]">
                            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                                <CircleNotch size={18} className="animate-spin" />
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-zinc-500 text-sm">
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 bg-black/40 border-t border-white/5">
                <div className="relative flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Describe your understanding..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-sm outline-none focus:border-fuchsia-500/50 transition-all"
                    />
                    <button
                        disabled={!input.trim() || isLoading}
                        onClick={handleSend}
                        className="absolute right-2 p-3 rounded-xl bg-linear-to-r from-fuchsia-600 to-violet-600 text-white disabled:opacity-30 transition-all hover:scale-[1.05] active:scale-95 shadow-lg shadow-fuchsia-500/20"
                    >
                        <PaperPlaneRight size={22} weight="bold" />
                    </button>
                </div>
            </div>
        </div>
    );
}
