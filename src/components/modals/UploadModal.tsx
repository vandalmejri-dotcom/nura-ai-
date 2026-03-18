'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    UploadSimple,
    LinkSimple,
    Keyboard,
    Sparkle,
    Check,
    CircleNotch,
    Warning,
    FilePdf
} from '@phosphor-icons/react';
import { upload } from '@vercel/blob/client';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: any) => void;
}

type Step = 'type' | 'file' | 'link' | 'text' | 'options' | 'processing';

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
    const [step, setStep] = useState<Step>('type');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [link, setLink] = useState('');
    const [rawText, setRawText] = useState('');
    const [options, setOptions] = useState<string[]>(['flashcards', 'quiz_arena', 'ai_synthesis', 'fill_in_the_blanks']);
    const [language, setLanguage] = useState('en');
    const [progress, setProgress] = useState(0);
    const [debugMessage, setDebugMessage] = useState('Waiting for text extraction...');
    const [error, setError] = useState('');

    const onDrop = React.useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles[0]) {
            setSelectedFile(acceptedFiles[0]);
            setStep('options');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt']
        },
        maxFiles: 1
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setStep('type');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setLink('');
        setRawText('');
        setOptions(['flashcards', 'quiz_arena', 'ai_synthesis', 'fill_in_the_blanks']);
        setProgress(0);
        setError('');
    };

    // Strict React state isolation & cleanup routine
    useEffect(() => {
        if (!isOpen) reset();
    }, [isOpen]);

    // Cleanup state specifically when switching modalities mid-action
    useEffect(() => {
        setError('');
    }, [step]);

    if (!isOpen) return null;

    const generationOptions = [
        { id: 'ai_synthesis', label: 'AI Synthesis', desc: 'Core Concepts & Mechanics' },
        { id: 'flashcards', label: 'Flashcards', desc: 'Active Recall' },
        { id: 'quiz_arena', label: 'Quiz Arena', desc: 'Deep Testing' },
        { id: 'fill_in_the_blanks', label: 'Fill in the Blanks', desc: 'Cloze Tests' },
        { id: 'podcast', label: 'Podcast', desc: 'Audio Learning' },
        { id: 'ai_tutor', label: 'AI Tutor', desc: 'Socratic Chat' },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setStep('options');
        }
    };

    const isValidYouTubeUrl = (url: string): boolean => {
        return url.includes('youtube.com') || url.includes('youtu.be');
    };

    const toggleOption = (id: string) => {
        setOptions(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
    };

    const startProcessing = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setStep('processing');
        setError('');
        setProgress(5);

        let isSuccess = false;
        let progressInterval: NodeJS.Timeout | null = null;

        try {
            let payload: any = { options, language };

            // Trickle progress while waiting for backend
            progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) return prev;
                    const increment = prev < 80 ? 1 : 0.2;
                    return Math.min(95, prev + increment);
                });

            }, 400);

            if (selectedFile) {
                // Direct-to-Storage upload for large files
                const blob = await upload(selectedFile.name, selectedFile, {
                    access: 'public',
                    handleUploadUrl: '/api/upload/blob',
                    clientPayload: JSON.stringify({ timestamp: Date.now(), filename: selectedFile.name }),
                    onUploadProgress: (progressEvent) => {
                        // Keep within 0-80% for upload phase
                        const upProg = Math.round(progressEvent.percentage * 0.8);
                        setProgress(Math.max(upProg, 5));
                    },
                });
                payload.blobUrl = blob.url;
                payload.fileName = selectedFile.name;
            } else if (link) {
                if (!isValidYouTubeUrl(link)) {
                    throw new Error("Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.");
                }
                payload.url = link; // Fix: Sending 'url' to match API expectation
                setProgress(30);
            } else if (rawText) {
                payload.text = rawText;
                setProgress(30);
            } else {
                throw new Error("No input provided.");
            }

            // Final processing step (PDF extraction + AI generation)
            const fetchRes = await fetch(selectedFile ? '/api/upload' : '/api/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!fetchRes.ok) {
                let errorDetails = "Server Error";
                const status = fetchRes.status;
                const responseText = await fetchRes.text().catch(() => "");
                
                try {
                    const data = JSON.parse(responseText);
                    errorDetails = data.error || data.message || errorDetails;
                } catch (e) {
                    errorDetails = responseText.length > 0 && responseText.length < 200 ? responseText : "Nura Engine returned an invalid response.";
                }

                // Precision Error Mapping - Defeating "Generic Error Fatigue"
                if (status === 429) {
                    errorDetails = "YouTube rate limit hit — please wait 60 seconds and retry.";
                } else if (status === 403) {
                    errorDetails = "This video is private and cannot be analyzed.";
                } else if (status === 500 && errorDetails.toLowerCase().includes('extraction failed')) {
                    errorDetails = "YouTube is aggressively blocking the automated harvester. 💡 PRO TIP: Go back, select 'Raw Text', and paste the transcript there for instant results!";
                }
                
                throw new Error(errorDetails);
            }


            // Halt interval once we have a response stream or JSON
            if (progressInterval) clearInterval(progressInterval);

            let result: any = null;
            const contentType = fetchRes.headers.get('content-type');

            if (contentType && contentType.includes('application/x-ndjson')) {
                const reader = fetchRes.body?.getReader();
                const decoder = new TextDecoder();
                if (reader) {
                    let bufferChars = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        bufferChars += decoder.decode(value, { stream: true });
                        const lines = bufferChars.split('\n');
                        bufferChars = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const data = JSON.parse(line);
                                if (data.type === 'debug') {
                                    if (data.progress) {
                                        if (progressInterval) {
                                            clearInterval(progressInterval);
                                            progressInterval = null;
                                        }
                                        setProgress(data.progress);
                                    }
                                    setDebugMessage(data.message || 'Processing...');
                                } else if (data.success !== undefined || data.type === 'result') {
                                    result = data.type === 'result' ? { success: true, data: data.data } : data;
                                } else if (data.type === 'error') {
                                    result = { success: false, error: data.error };
                                }
                            } catch (e) { }
                        }
                    }
                }
            } else {
                result = await fetchRes.json().catch(() => ({ success: false, error: "Malformed server response (Broken JSON)." }));
            }

            if (result && result.success) {
                setProgress(100);
                isSuccess = true;
                setTimeout(() => {
                    onSuccess(result.data);
                    onClose();
                    reset();
                }, 800);
            } else {
                throw new Error(result?.error || result?.message || 'Mission Logic Error. Contact Support.');
            }
        } catch (err: any) {
            // Swallow dev error logging to avoid Red Screen overlay, use clear UI feedback instead
            const errorMsg = err.message || 'Fatal Network Disruption.';
            setError(errorMsg);
            toast.error(errorMsg);
        }
        finally {
            if (progressInterval) clearInterval(progressInterval);
            if (!isSuccess) {
                setStep('options');
                setProgress(0);
            }
        }
    };



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-xl glass-dark rounded-3xl overflow-hidden shadow-2xl animate-slide-up border-white/10">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                            <Sparkle size={18} weight="fill" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Launch New Mission</h2>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Step {step === 'processing' ? '3' : step === 'options' ? '2' : '1'} of 3</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    {step === 'type' && (
                        <div className="grid grid-cols-1 gap-4">
                            <div
                                {...getRootProps()}
                                className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${isDragActive
                                    ? 'border-fuchsia-500 bg-fuchsia-500/10'
                                    : 'border-white/10 hover:border-fuchsia-500/30 hover:bg-white/5'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <div className={`p-4 rounded-xl mb-4 transition-colors ${isDragActive ? 'bg-fuchsia-500 text-white' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                    <UploadSimple size={32} weight="bold" />
                                </div>
                                <h3 className="font-bold text-lg mb-1">{isDragActive ? 'Drop file here' : 'Drag & Drop File'}</h3>
                                <p className="text-sm text-zinc-500">or click to browse PDF, Word, or Text docs</p>
                            </div>

                            <button
                                onClick={() => setStep('link')}
                                className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/30 hover:bg-white/10 transition-all text-left group"
                            >
                                <div className="p-3 rounded-xl bg-zinc-800 text-zinc-400 group-hover:text-violet-400 transition-colors">
                                    <LinkSimple size={24} weight="bold" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Paste Link</h3>
                                    <p className="text-sm text-zinc-500">YouTube videos or web articles</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('text')}
                                className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 transition-all text-left group"
                            >
                                <div className="p-3 rounded-xl bg-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-colors">
                                    <Keyboard size={24} weight="bold" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Raw Text</h3>
                                    <p className="text-sm text-zinc-500">Paste snippets or handwritten notes</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'link' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-400">YouTube or Article URL</label>
                                <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-4 focus-within:border-fuchsia-500/50 transition-all">
                                    <LinkSimple size={20} className="text-zinc-600" />
                                    <input
                                        autoFocus
                                        value={link}
                                        onChange={(e) => setLink(e.target.value)}
                                        placeholder="https://..."
                                        className="bg-transparent border-none outline-none flex-1 text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                disabled={!link}
                                onClick={() => setStep('options')}
                                className="w-full py-4 rounded-2xl bg-fuchsia-600 disabled:opacity-50 font-bold hover:bg-fuchsia-500 transition-colors shadow-lg shadow-fuchsia-900/20"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {step === 'text' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-400">Paste your content</label>
                                <textarea
                                    autoFocus
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    placeholder="Paste your course notes, transcript, or scientific text here..."
                                    className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-4 focus-within:border-fuchsia-500/50 transition-all outline-none resize-none text-sm font-medium"
                                />
                            </div>
                            <button
                                disabled={!rawText}
                                onClick={() => setStep('options')}
                                className="w-full py-4 rounded-2xl bg-fuchsia-600 disabled:opacity-50 font-bold hover:bg-fuchsia-500 transition-colors shadow-lg shadow-fuchsia-900/20"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {step === 'options' && (
                        <div className="space-y-8 animate-slide-up">
                            <div className="space-y-4">
                                <h3 className="font-bold text-zinc-300 uppercase tracking-widest text-[10px]">What would you like to include?</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {generationOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleOption(opt.id)}
                                            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${options.includes(opt.id)
                                                ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-zinc-100'
                                                : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${options.includes(opt.id) ? 'bg-fuchsia-500 border-fuchsia-500 text-white' : 'border-zinc-700'
                                                }`}>
                                                {options.includes(opt.id) && <Check size={12} weight="bold" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{opt.label}</p>
                                                <p className="text-[10px] opacity-60 font-medium whitespace-nowrap">{opt.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={(e) => startProcessing(e)} className="flex items-center justify-between pt-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Output Language</p>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="bg-zinc-800 border-none rounded-lg text-sm px-3 py-1.5 font-semibold text-zinc-200 outline-none cursor-pointer"
                                    >
                                        <option value="en">English (US)</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                        <option value="de">German</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="px-8 py-3.5 rounded-2xl bg-zinc-100 text-black font-bold hover:bg-white transition-all shadow-xl active:scale-95"
                                >
                                    Confirm & Launch
                                </button>
                            </form>

                            {error && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
                                    <Warning size={16} weight="fill" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-8 animate-slide-up">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full border-4 border-fuchsia-500/20 border-t-fuchsia-500 animate-spin" />
                                <CircleNotch className="absolute inset-0 m-auto animate-spin-reverse text-zinc-700" size={40} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold italic tracking-tight">Analyzing with <span className="text-gradient">AI Engine</span></h3>
                                <p className="text-sm text-zinc-500 max-w-xs mx-auto">Our specialized pedagogical models are extracting concepts, building flashcards, and generating Cornell notes.</p>
                            </div>

                            <div className="w-full max-w-sm space-y-3">
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-fuchsia-600 to-violet-600 transition-all duration-300"
                                        style={{ width: `${Math.round(progress)}%` }}
                                    />

                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                    <span>Processing: {selectedFile?.name || 'Content'}</span>
                                    <span>{Math.round(progress)}%</span>

                                </div>
                            </div>

                            <div className="text-[10px] text-fuchsia-400 mt-4 p-2 bg-fuchsia-900/20 rounded border border-fuchsia-500/30 w-full max-w-sm text-left font-mono">
                                <strong>DEBUG:</strong> {debugMessage}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
