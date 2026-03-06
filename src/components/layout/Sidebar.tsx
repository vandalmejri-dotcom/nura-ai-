'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    House,
    Books,
    ChatTeardropDots,
    ChartLineUp,
    Gear,
    Brain,
    CaretRight
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useStudySets } from '@/context/StudySetsContext';

const Sidebar = () => {
    const pathname = usePathname();
    const { sets } = useStudySets();

    const menuItems = [
        { name: 'Dashboard', icon: House, path: '/' },
        { name: 'Study Sets', icon: Books, path: '/sets' },
        { name: 'AI Tutor', icon: ChatTeardropDots, path: '/tutor' },
        { name: 'Progress', icon: ChartLineUp, path: '/progress' },
    ];

    return (
        <aside className="w-72 h-screen glass-dark flex flex-col p-6 sticky top-0 overflow-y-auto no-scrollbar border-r border-white/5">
            {/* Logo Section */}
            <div className="flex items-center gap-3 mb-10 px-2 shrink-0">
                <div className="relative w-10 h-10 aspect-square">
                    <Image
                        src="/logo.png"
                        alt="Nura AI Logo"
                        fill
                        className="object-contain mix-blend-screen"
                    />
                </div>
                <span className="text-xl font-bold tracking-tight text-gradient">nura ai</span>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1 mb-8 shrink-0">
                {menuItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-fuchsia-500/10 text-fuchsia-400 font-bold'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                                }`}
                        >
                            <item.icon
                                size={22}
                                weight={isActive ? 'fill' : 'regular'}
                                className={isActive ? 'text-fuchsia-500' : 'group-hover:text-zinc-100'}
                            />
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Recent Missions (Dynamic) */}
            <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
                <div className="px-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Recent Missions</span>
                    <span className="text-[10px] font-bold text-fuchsia-500/40">{sets.length}</span>
                </div>

                <div className="space-y-1 overflow-y-auto no-scrollbar flex-1 pb-4">
                    {sets.length === 0 ? (
                        <div className="px-4 py-4 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-zinc-600 italic text-center">
                            No missions launched yet.
                        </div>
                    ) : (
                        sets.slice(0, 10).map(set => (
                            <Link
                                key={set.id}
                                href={`/sets/${set.id}`}
                                className={`flex items-center justify-between group px-4 py-3 rounded-xl transition-all border border-transparent ${pathname === `/sets/${set.id}`
                                        ? 'bg-white/5 border-white/5 text-zinc-100'
                                        : 'text-zinc-500 hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className="w-2 h-2 rounded-full bg-fuchsia-500 shadow-lg shadow-fuchsia-500/50" />
                                    <span className="text-xs font-semibold truncate">{set.title}</span>
                                </div>
                                <CaretRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Footer / User Profile */}
            <div className="pt-6 border-t border-white/5 space-y-4 shrink-0">
                <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${pathname === '/settings'
                            ? 'bg-white/10 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                >
                    <Gear size={22} />
                    <span className="text-sm">Settings</span>
                </Link>

                <div className="flex items-center gap-3 px-3 py-4 bg-white/[0.03] rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-fuchsia-600 to-violet-600 flex items-center justify-center font-bold text-sm text-white border border-white/20 shadow-xl shadow-fuchsia-500/10">
                        W
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-zinc-100 truncate">Wafa Mefteh</span>
                        <span className="text-[10px] text-fuchsia-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                            <Brain size={12} weight="fill" /> Neural Pro
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
