'use client';
import { ArrowLeft } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-slide-up">
            <h2 className="text-3xl font-bold tracking-tight">Mission Settings</h2>
            <p className="text-zinc-400">System configurations and preferences.</p>
            <button onClick={() => router.push('/')} className="text-fuchsia-500 font-bold flex items-center gap-2 mt-4">
                <ArrowLeft weight="bold" /> Back to Dashboard
            </button>
        </div>
    );
}
