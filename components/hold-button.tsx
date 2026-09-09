'use client';

import { useRef, useState } from 'react';

// Hold-to-confirm for destructive actions: press-and-hold fills the button
// over 2s (deliberate), release snaps back in 200ms. Prevents slips.
export function HoldButton({
  children,
  onConfirm,
  className = '',
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const [filling, setFilling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setHolding(true);
    requestAnimationFrame(() => setFilling(true));
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setFilling(false);
      onConfirm();
    }, 2000);
  }

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
    setFilling(false);
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden rounded border border-ivory/20 px-2 py-1 text-xs hover:bg-white/5 ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[rgb(196_160_72/0.3)]"
        style={{
          clipPath: filling ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
          transition: filling
            ? 'clip-path 2s linear'
            : 'clip-path 200ms ease-out',
        }}
      />
      <span className="relative">{holding ? 'Keep holding…' : children}</span>
    </button>
  );
}
