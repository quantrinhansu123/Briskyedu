import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into document.body via React Portal.
 * Use this to wrap modal/dialog overlays so they escape
 * the layout's stacking context (header, sidebar, overflow-hidden).
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
