'use client';

import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
    isUploadModalOpen: boolean;
    openUploadModal: () => void;
    closeUploadModal: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);

    const openUploadModal = () => setUploadModalOpen(true);
    const closeUploadModal = () => setUploadModalOpen(false);

    return (
        <UIContext.Provider value={{ isUploadModalOpen, openUploadModal, closeUploadModal }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
