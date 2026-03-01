import { useEffect, useState, useCallback, CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  /** Whether the dropdown is visible */
  isOpen: boolean;
  /** Called when dropdown should close (click outside, scroll, Escape) */
  onClose: () => void;
  /** DOMRect of the trigger button - used to position the dropdown */
  anchorRect: DOMRect | null;
  /** Menu items to render inside the dropdown */
  children: ReactNode;
}

const MENU_WIDTH = 192; // Tailwind w-48 = 12rem = 192px
const MENU_HEIGHT_ESTIMATE = 260; // Approximate max height for 6 items
const EDGE_PADDING = 8; // Minimum distance from viewport edge

/**
 * Renders a dropdown menu via React Portal (into document.body).
 * This escapes any parent overflow-hidden/auto clipping.
 * Includes smart positioning: flips upward if not enough space below.
 */
export function PortalDropdown({ isOpen, onClose, anchorRect, children }: PortalDropdownProps) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  // Stable close reference for event listeners
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!isOpen || !anchorRect) return;

    // Calculate position: below button by default, flip up if near bottom
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const shouldFlipUp = spaceBelow < MENU_HEIGHT_ESTIMATE;

    setMenuStyle({
      position: 'fixed',
      top: shouldFlipUp ? undefined : anchorRect.bottom + 4,
      bottom: shouldFlipUp ? window.innerHeight - anchorRect.top + 4 : undefined,
      left: Math.max(EDGE_PADDING, anchorRect.right - MENU_WIDTH),
      width: MENU_WIDTH,
      zIndex: 9999,
    });

    // Close dropdown when user scrolls or resizes (position would be stale)
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);

    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [isOpen, anchorRect, handleClose]);

  if (!isOpen || !anchorRect) return null;

  return createPortal(
    <>
      {/* Invisible overlay to catch click-outside */}
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={handleClose} />
      {/* Dropdown menu */}
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 py-1"
        style={menuStyle}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
