/**
 * useModalState Hook Test Suite
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useModalState, useMultiModalState } from './useModalState';

describe('useModalState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('should initialize as closed', () => {
    const { result } = renderHook(() => useModalState());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe(null);
  });

  it('should initialize as open when initialOpen is true', () => {
    const { result } = renderHook(() => useModalState(true));
    expect(result.current.isOpen).toBe(true);
  });

  it('should open modal without data', () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe(null);
  });

  it('should open modal with data', () => {
    const { result } = renderHook(() => useModalState<{ id: number; name: string }>());

    act(() => {
      result.current.open({ id: 123, name: 'Test' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: 123, name: 'Test' });
  });

  it('should close modal and clear data', () => {
    const { result } = renderHook(() => useModalState<{ id: number }>());

    act(() => {
      result.current.open({ id: 123 });
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    // Data is cleared after 200ms delay (for animation)
    expect(result.current.data).toEqual({ id: 123 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.data).toBe(null);
  });

  it('should toggle modal state', () => {
    const { result } = renderHook(() => useModalState());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

describe('useMultiModalState', () => {
  type ModalType = 'create' | 'edit' | 'delete';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with no active modal', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());
    expect(result.current.activeModal).toBe(null);
    expect(result.current.modalData).toBe(null);
  });

  it('should open specific modal', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());

    act(() => {
      result.current.openModal('create');
    });

    expect(result.current.activeModal).toBe('create');
  });

  it('should open modal with data', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());

    act(() => {
      result.current.openModal('edit', { id: 'item-123' });
    });

    expect(result.current.activeModal).toBe('edit');
    expect(result.current.modalData).toEqual({ id: 'item-123' });
  });

  it('should close modal and clear data', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());

    act(() => {
      result.current.openModal('delete', { id: 'item-456' });
    });

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.activeModal).toBe(null);
    // Data is cleared after 200ms delay (for animation)
    expect(result.current.modalData).toEqual({ id: 'item-456' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.modalData).toBe(null);
  });

  it('should check if specific modal is open', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());

    expect(result.current.isModalOpen('create')).toBe(false);
    expect(result.current.isModalOpen('edit')).toBe(false);

    act(() => {
      result.current.openModal('create');
    });

    expect(result.current.isModalOpen('create')).toBe(true);
    expect(result.current.isModalOpen('edit')).toBe(false);
    expect(result.current.isModalOpen('delete')).toBe(false);
  });

  it('should switch between modals', () => {
    const { result } = renderHook(() => useMultiModalState<ModalType>());

    act(() => {
      result.current.openModal('create');
    });
    expect(result.current.activeModal).toBe('create');

    act(() => {
      result.current.openModal('edit');
    });
    expect(result.current.activeModal).toBe('edit');
    expect(result.current.isModalOpen('create')).toBe(false);
  });
});
