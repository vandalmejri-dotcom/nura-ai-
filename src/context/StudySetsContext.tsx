'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface StudySet {
    id: string;
    title: string;
    sourceName: string;
    generatedBy: string;
    sourceContent?: string;
    sourceUrl?: string;
    rawContent?: string;
    stats: {
        wordCount: number;
        characterCount: number;
        cardCount: number;
        quizCount: number;
        fibCount: number;
    };
    flashcards?: any[] | null;
    quiz?: any[] | null;
    notes?: string | null;
    synthesizedNotes?: string | null;
    podcast?: string | null;
    tutorLesson?: string | null;
    writtenTests?: string | null;
    fillInTheBlanks?: any[] | null;
    detectedLanguage?: string | null;
    masteryTiers?: {
        Unfamiliar: number;
        Learning: number;
        Familiar: number;
        Mastered: number;
    };
    createdAt: number;
}

interface StudySetsContextType {
    sets: StudySet[];
    loading: boolean;
    addSet: (set: StudySet) => void;
    deleteSet: (id: string) => void;
    syncMastery: (setId: string, conceptId: string, feedback: 'forgot' | 'hard' | 'good' | 'easy' | 'correct' | 'wrong') => void;
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

    const syncMastery = (setId: string, conceptId: string, feedback: 'forgot' | 'hard' | 'good' | 'easy' | 'correct' | 'wrong') => {
        setSets(prevSets => {
            const updatedSets = prevSets.map(set => {
                if (set.id !== setId) return set;

                // 1. Function to update mastery in an array
                const updateItemMastery = (arr: any) => {
                    if (!Array.isArray(arr)) return arr;
                    return arr.map(item => {
                        if (item && item.id === conceptId) {
                            let m = item.mastery || 0;
                            if (feedback === 'forgot' || feedback === 'wrong') m = 0;
                            else if (feedback === 'good' || feedback === 'correct' || feedback === 'easy') m = Math.min(m + 1, 3);
                            return { ...item, mastery: m };
                        }
                        return item;
                    });
                };

                // 2. Update all relevant arrays
                const updatedFlashcards = updateItemMastery(set.flashcards);
                const updatedQuiz = updateItemMastery(set.quiz);
                const updatedFillInTheBlanks = updateItemMastery(set.fillInTheBlanks);

                // 3. Recalculate Mastery Tiers based on THE MOST RECENTLY UPDATED ARRAY 
                // (or across all, but usually one module is active)
                // We'll trust the component to manage its own subset, but the global counters
                // should reflect the status of all items. 
                // For simplicity, we'll sum up counts across all items in all arrays (avoiding duplicates if possible)
                // But since they might be different items, let's just use the current set's arrays.

                const safeF = Array.isArray(updatedFlashcards) ? updatedFlashcards : [];
                const safeQ = Array.isArray(updatedQuiz) ? updatedQuiz : [];
                const safeFib = Array.isArray(updatedFillInTheBlanks) ? updatedFillInTheBlanks : [];
                const allItems = [...safeF, ...safeQ, ...safeFib];
                const newTiers = { Unfamiliar: 0, Learning: 0, Familiar: 0, Mastered: 0 };

                allItems.forEach(item => {
                    if (!item) return;
                    const m = item.mastery || 0;
                    if (m === 3) newTiers.Mastered++;
                    else if (m === 2) newTiers.Familiar++;
                    else if (m === 1) newTiers.Learning++;
                    else newTiers.Unfamiliar++;
                });

                return {
                    ...set,
                    flashcards: updatedFlashcards,
                    quiz: updatedQuiz,
                    fillInTheBlanks: updatedFillInTheBlanks,
                    masteryTiers: newTiers
                };
            });
            localStorage.setItem('nura_study_sets', JSON.stringify(updatedSets));
            return updatedSets;
        });
    };

    return (
        <StudySetsContext.Provider value={{ sets, loading, addSet, deleteSet, syncMastery }}>
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
