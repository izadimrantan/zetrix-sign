'use client';

import { useRef, useState, useCallback } from 'react';
import type { SignaturePosition } from '@/types/signing';

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
  const dragStart = useRef({ x: 0, y: 0 });

  // Default position if none set
  const pos = position || { x: 0.3, y: 0.7, page: currentPage, width: 0.3, height: 0.08 };
  const absX = pos.x * containerWidth;
  const absY = pos.y * containerHeight;
  const absW = pos.width * containerWidth;
  const absH = pos.height * containerHeight;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
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

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${absX}px`,
        top: `${absY}px`,
        width: `${absW}px`,
        height: `${absH}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        border: '2px dashed hsl(var(--primary))',
        borderRadius: '4px',
        background: 'rgba(123, 30, 30, 0.05)',
        zIndex: 10,
      }}
    >
      <img
        src={signatureImage}
        alt="Signature"
        className="h-full w-full object-contain pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
