'use client';

import React from 'react';
import {
    Bell,
    MagnifyingGlass,
    Sparkle,
    Plus
} from '@phosphor-icons/react';
import { useUI } from '@/context/UIContext';

const Navbar = () => {
    const { openUploadModal } = useUI();

    return (
        <header className="h-20 glass border-b-0 sticky top-0 z-30 flex items-center justify-between px-8 mx-6 mt-4 rounded-2xl">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
                <div className="relative group">
                    <MagnifyingGlass
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-fuchsia-500 transition-colors"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Search your knowledge base..."
                        className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-sm text-zinc-200 outline-none focus:border-fuchsia-500/50 focus:bg-black/40 transition-all"
                    />
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* AI Status */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[11px] font-bold text-fuchsia-400 uppercase tracking-widest animate-pulse">
                    <Sparkle size={14} weight="fill" />
                    AI Engine Online
                </div>

                <button className="p-2.5 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all relative">
                    <Bell size={22} />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-fuchsia-500 rounded-full border-2 border-zinc-900"></span>
                </button>

                <button
                    onClick={openUploadModal}
                    className="flex items-center gap-2 bg-linear-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-xl shadow-fuchsia-500/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                    <Plus size={18} weight="bold" />
                    New Mission
                </button>
            </div>
        </header>
    );
};

export default Navbar;
