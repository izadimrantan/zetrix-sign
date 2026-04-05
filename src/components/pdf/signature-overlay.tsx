'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { SignaturePosition } from '@/types/signing';

const NUDGE_KEYFRAMES = `
@keyframes signature-nudge {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-8px, 0); }
  40% { transform: translate(8px, 0); }
  60% { transform: translate(-4px, 0); }
  80% { transform: translate(4px, 0); }
}
`;

interface Props {
  signatureImage: string;
  position: SignaturePosition | null;
  onPositionChange: (position: SignaturePosition) => void;
  containerWidth: number;
  containerHeight: number;
  currentPage: number;
}

export function SignatureOverlay({
  signatureImage,
  position,
  onPositionChange,
  containerWidth,
  containerHeight,
  currentPage,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const dragStart = useRef({ x: 0, y: 0 });

  // Stop nudge animation after it plays
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Default position: top-right corner
  // Auto-signature image is 400x100 (4:1). Drawn signature is 600x160 (3.75:1).
  // Compute box height from width to maintain ~4:1 aspect ratio regardless of page size.
  const SIG_ASPECT = 4; // width:height ratio
  const defaultW = 0.4;
  // Convert aspect: height (as % of page) = (width_px / SIG_ASPECT) / containerHeight
  const defaultH = (defaultW * containerWidth) / (SIG_ASPECT * containerHeight);

  const pos = position
    ? {
        ...position,
        // Enforce aspect ratio on stored positions too (fixes tall boxes from old sessions)
        height: (position.width * containerWidth) / (SIG_ASPECT * containerHeight),
      }
    : { x: 0.55, y: 0.03, page: currentPage, width: defaultW, height: defaultH };

  const absX = pos.x * containerWidth;
  const absY = pos.y * containerHeight;
  const absW = pos.width * containerWidth;
  const absH = pos.height * containerHeight;

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsAnimating(false);
    setIsDragging(true);
    dragStart.current = { x: e.clientX - absX, y: e.clientY - absY };

    const handleMouseMove = (me: MouseEvent) => {
      const newX = Math.max(0, Math.min((me.clientX - dragStart.current.x) / containerWidth, 1 - pos.width));
      const newY = Math.max(0, Math.min((me.clientY - dragStart.current.y) / containerHeight, 1 - pos.height));
      onPositionChange({ ...pos, x: newX, y: newY, page: currentPage });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [absX, absY, containerWidth, containerHeight, pos, currentPage, onPositionChange]);

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent page scroll while dragging signature
    e.stopPropagation();
    setIsAnimating(false);
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - absX, y: touch.clientY - absY };

    const handleTouchMove = (te: TouchEvent) => {
      te.preventDefault(); // Prevent scroll during drag
      const t = te.touches[0];
      const newX = Math.max(0, Math.min((t.clientX - dragStart.current.x) / containerWidth, 1 - pos.width));
      const newY = Math.max(0, Math.min((t.clientY - dragStart.current.y) / containerHeight, 1 - pos.height));
      onPositionChange({ ...pos, x: newX, y: newY, page: currentPage });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [absX, absY, containerWidth, containerHeight, pos, currentPage, onPositionChange]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NUDGE_KEYFRAMES }} />
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: 'absolute',
          left: `${absX}px`,
          top: `${absY}px`,
          width: `${absW}px`,
          height: `${absH}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          border: '2.5px solid #7b1e1e',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 6px 20px rgba(123, 30, 30, 0.3), 0 0 0 1px rgba(123, 30, 30, 0.2)',
          zIndex: 10,
          touchAction: 'none', // Prevent browser scroll/zoom on touch
          animation: isAnimating ? 'signature-nudge 0.8s ease-in-out 0.4s' : 'none',
        }}
      >
        <img
          src={signatureImage}
          alt="Signature"
          className="h-full w-full object-contain pointer-events-none"
          draggable={false}
        />
      </div>
    </>
  );
}
