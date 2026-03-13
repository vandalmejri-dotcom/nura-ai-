'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
    FilePdf,
    TextT,
    LinkSimple,
    Copy,
    YoutubeLogo
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface RawPreviewPaneProps {
    sourceUrl?: string;
    rawContent?: string;
    fileName?: string;
}

/**
 * Bulletproof YouTube ID extractor
 * Handles: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, etc.
 */
const extractYouTubeID = (url: string) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return (match && match[1]) ? match[1] : null;
};

export default function RawPreviewPane({ sourceUrl, rawContent, fileName }: RawPreviewPaneProps) {
    const videoId = sourceUrl ? extractYouTubeID(sourceUrl) : null;
    const isYouTube = !!videoId;

    const copyToClipboard = () => {
        if (rawContent) {
            navigator.clipboard.writeText(rawContent);
            toast.success("Copied to clipboard!");
        }
    };

    return (
        <div className="space-y-8 animate-slide-up">
            {/* Header / Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400">
                        {isYouTube ? <YoutubeLogo weight="fill" size={28} className="text-red-500" /> :
                            fileName?.toLowerCase().endsWith('.pdf') ? <FilePdf weight="fill" size={28} className="text-orange-500" /> :
                                <TextT weight="bold" size={28} />}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold tracking-tight">{isYouTube ? "YouTube Source" : "Original Material"}</h3>
                        <p className="text-sm text-zinc-500 font-medium truncate max-w-[200px] md:max-w-md">{sourceUrl || fileName || 'Raw Input'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={copyToClipboard}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-sm font-bold border border-white/5 active:scale-95"
                    >
                        <Copy size={18} /> Copy Content
                    </button>
                    {sourceUrl && (
                        <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all border border-fuchsia-500/10"
                        >
                            <LinkSimple size={20} weight="bold" />
                        </a>
                    )}
                </div>
            </div>

            {/* Video Embed - Nura "Cyber" Aesthetic */}
            {isYouTube && (
                <div className="w-full aspect-video rounded-xl border border-white/10 shadow-[0_0_30px_rgba(168,85,247,0.15)] overflow-hidden bg-black">
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube Video Preview"
                    />
                </div>
            )}

            {/* Hybrid Content View / Transcript */}
            <div className="glass-dark border-white/10 rounded-3xl overflow-hidden">
                <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-4">
                        {isYouTube ? "Video Transcript Extraction" : "Raw Content Engine v1.0"}
                    </span>
                    <div className="flex items-center gap-1.5 px-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                    </div>
                </div>
                <div className={`p-8 md:p-12 ${isYouTube ? 'max-h-64' : 'max-h-[700px]'} overflow-y-auto custom-scrollbar bg-black/20`}>
                    <div className="text-zinc-300 leading-relaxed space-y-4">
                        {rawContent ? (
                            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-white/5">
                                <ReactMarkdown>{rawContent}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                                <TextT size={48} weight="thin" />
                                <p className="font-bold italic">No content detected for preview.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer action */}
            {!isYouTube && sourceUrl && (
                <div className="p-6 rounded-2xl bg-fuchsia-500/5 border border-fuchsia-500/10 flex items-center justify-between">
                    <p className="text-sm text-zinc-400 font-medium italic">Content extracted from external source</p>
                    <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fuchsia-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
                    >
                        View External Link <LinkSimple weight="bold" />
                    </a>
                </div>
            )}
        </div>
    );
}
