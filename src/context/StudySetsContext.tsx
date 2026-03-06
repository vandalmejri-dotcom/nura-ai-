'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface StudySet {
    id: string;
    title: string;
    sourceName: string;
    generatedBy: string;
    sourceContent?: string;
    stats: {
        wordCount: number;
        characterCount: number;
        cardCount: number;
        quizCount: number;
    };
    flashcards?: any[] | null;
    quiz?: any[] | null;
    notes?: string | null;
    podcast?: string | null;
    tutorLesson?: string | null;
    writtenTests?: string | null;
    fillInTheBlanks?: string | null;
    createdAt: number;
}

interface StudySetsContextType {
    sets: StudySet[];
    loading: boolean;
    addSet: (set: StudySet) => void;
    deleteSet: (id: string) => void;
}

const StudySetsContext = createContext<StudySetsContextType | undefined>(undefined);

export function StudySetsProvider({ children }: { children: React.ReactNode }) {
    const [sets, setSets] = useState<StudySet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('nura_study_sets');
        if (saved) {
            try {
                setSets(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse sets from localStorage');
            }
        }
        setLoading(false);
    }, []);

    const saveSets = (newSets: StudySet[]) => {
        setSets(newSets);
        localStorage.setItem('nura_study_sets', JSON.stringify(newSets));
    };

    const addSet = (set: StudySet) => {
        const updated = [set, ...sets];
        saveSets(updated);
    };

    const deleteSet = (id: string) => {
        const updated = sets.filter(s => s.id !== id);
        saveSets(updated);
    };

    return (
        <StudySetsContext.Provider value={{ sets, loading, addSet, deleteSet }}>
            {children}
        </StudySetsContext.Provider>
    );
}

export function useStudySets() {
    const context = useContext(StudySetsContext);
    if (context === undefined) {
        throw new Error('useStudySets must be used within a StudySetsProvider');
    }
    return context;
}
