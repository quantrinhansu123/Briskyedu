/**
 * Modal State Hook
 * Reusable modal state management
 */

import { useState, useCallback } from 'react';

export interface ModalState<T = unknown> {
  isOpen: boolean;
  data: T | null;
  open: (data?: T) => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Reusable modal state hook
 * Eliminates repetitive [showModal, setShowModal] patterns
 */
export function useModalState<T = unknown>(initialOpen = false): ModalState<T> {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((modalData?: T) => {
    setData(modalData ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Delay clearing data to allow close animation
    setTimeout(() => setData(null), 200);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return { isOpen, data, open, close, toggle };
}

/**
 * Hook for managing multiple modals with single active modal
 */
export function useMultiModalState<T extends string>() {
  const [activeModal, setActiveModal] = useState<T | null>(null);
  const [modalData, setModalData] = useState<unknown>(null);

  const openModal = useCallback((modal: T, data?: unknown) => {
    setActiveModal(modal);
    setModalData(data ?? null);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setTimeout(() => setModalData(null), 200);
  }, []);

  const isModalOpen = useCallback((modal: T) => activeModal === modal, [activeModal]);

  return {
    activeModal,
    modalData,
    openModal,
    closeModal,
    isModalOpen
  };
}
