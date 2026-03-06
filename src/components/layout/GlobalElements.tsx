'use client';

import React from 'react';
import { useUI } from '@/context/UIContext';
import { useStudySets } from '@/context/StudySetsContext';
import UploadModal from '@/components/modals/UploadModal';

export default function GlobalElements() {
    const { isUploadModalOpen, closeUploadModal } = useUI();
    const { addSet } = useStudySets();

    return (
        <UploadModal
            isOpen={isUploadModalOpen}
            onClose={closeUploadModal}
            onSuccess={(data) => addSet({ ...data, id: data.id || `set_${Date.now()}`, createdAt: Date.now() })}
        />
    );
}
