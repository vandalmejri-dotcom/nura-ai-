'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  UploadSimple,
  LinkSimple,
  Keyboard,
  ArrowRight,
  Sparkle,
  Books,
  Trash
} from '@phosphor-icons/react';
import { useStudySets, StudySet } from '@/context/StudySetsContext';
import { useUI } from '@/context/UIContext';
import Link from 'next/link';

export default function Dashboard() {
  const { sets, deleteSet, loading } = useStudySets();
  const { openUploadModal } = useUI();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const uploadOptions = [
    {
      id: 'file',
      title: 'Upload File',
      desc: 'PDF, DOCX, or TXT (Max 50MB)',
      icon: UploadSimple,
      color: 'from-fuchsia-600 to-pink-500'
    },
    {
      id: 'link',
      title: 'Paste Link',
      desc: 'YouTube, Article, or URL',
      icon: LinkSimple,
      color: 'from-violet-600 to-blue-500'
    },
    {
      id: 'text',
      title: 'Raw Text',
      desc: 'Notes, Scribbles, or Snippets',
      icon: Keyboard,
      color: 'from-emerald-600 to-teal-500'
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* Welcome Section */}
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
          <Sparkle size={14} className="text-fuchsia-500" />
          Mission Control
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight">
          What are we <span className="text-gradient">mastering</span> today?
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          Upload your materials and let Nura AI transform them into structured mastery sets, interactive quizzes, and personalized tutoring sessions.
        </p>
      </section>

      {/* Main Upload Actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {uploadOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={openUploadModal}
            className="group flex flex-col items-start p-8 rounded-2xl glass-dark hover:bg-white/5 border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 text-left relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-linear-to-br ${opt.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity`} />

            <div className={`p-4 rounded-xl mb-6 bg-linear-to-br ${opt.color} shadow-lg shadow-black/40 group-hover:scale-110 transition-transform`}>
              <opt.icon size={28} weight="bold" className="text-white" />
            </div>

            <h3 className="text-xl font-bold text-zinc-100 mb-2">{opt.title}</h3>
            <p className="text-sm text-zinc-500 mb-6 flex-1">{opt.desc}</p>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-fuchsia-400 transition-colors">
              Get Started <ArrowRight size={14} weight="bold" />
            </div>
          </button>
        ))}
      </section>

      {/* Study Sets Grid Header */}
      <section className="space-y-6 pt-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold whitespace-nowrap">Your Study Sets</h2>
          <div className="h-px bg-white/5 flex-1" />
        </div>

        {(!mounted || loading) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => <div key={i} className="h-52 glass-dark rounded-2xl animate-pulse" />)}
          </div>
        ) : sets.length === 0 ? (
          <div className="glass-dark border-dashed border-white/10 rounded-2xl p-20 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-white/20 transition-all" onClick={openUploadModal}>
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
              <Plus size={32} weight="bold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No missions launched yet</h3>
              <p className="text-zinc-500 text-sm">Upload your first document to start dominating.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-20">
            {sets.map(set => (
              <StudyCard key={set.id} set={set} onDelete={deleteSet} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StudyCard({ set, onDelete }: { set: StudySet, onDelete: (id: string) => void }) {
  return (
    <div className="group relative">
      <Link href={`/sets/${set.id}`} className="block">
        <div className="glass-dark border-white/5 hover:border-white/10 p-6 rounded-2xl space-y-6 transition-all duration-300 hover:bg-white/[0.07] hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div className="max-w-[75%]">
              <h3 className="text-xl font-bold text-zinc-100 group-hover:text-fuchsia-400 transition-colors line-clamp-1">{set.title}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{set.sourceName}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 text-zinc-400">
              <Books size={22} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/10">
              <div className="text-sm font-bold text-fuchsia-500">{set.stats.cardCount}</div>
              <div className="text-[10px] font-bold text-fuchsia-500/60 uppercase tracking-widest">Cards</div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <div className="text-sm font-bold text-violet-500">{set.stats.quizCount}</div>
              <div className="text-[10px] font-bold text-violet-500/60 uppercase tracking-widest">Questions</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-6 h-6 rounded-full border-2 border-zinc-900 ${i === 1 ? 'bg-fuchsia-600' : i === 2 ? 'bg-violet-600' : 'bg-emerald-600'}`} />
              ))}
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              {new Date(set.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(set.id); }}
        className="absolute bottom-6 right-6 p-2 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
      >
        <Trash size={18} />
      </button>
    </div>
  );
}
