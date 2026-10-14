'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Segmented tabs with a clip-path indicator.
 *
 * The row is rendered twice: real buttons underneath, an identical brass-filled
 * copy on top clipped to the active tab. Animating the clip moves the pill and
 * flips the label colour in perfect sync — something you can never get by
 * timing two separate colour transitions against each other.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Start fully clipped away so there's no flash of a mispositioned pill.
  const [clip, setClip] = useState('inset(0 100% 0 0 round 9999px)');
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const active = row.querySelector<HTMLElement>(`[data-tab="${value}"]`);
      if (!active) return;
      const left = active.offsetLeft;
      const right = row.offsetWidth - (left + active.offsetWidth);
      setClip(`inset(0 ${right}px 0 ${left}px round 9999px)`);
      setReady(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [value, tabs]);

  // Fonts land after first paint and shift tab widths; re-measure once they do.
  useEffect(() => {
    document.fonts?.ready.then(() => {
      const row = rowRef.current;
      const active = row?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
      if (!row || !active) return;
      const left = active.offsetLeft;
      setClip(`inset(0 ${row.offsetWidth - (left + active.offsetWidth)}px 0 ${left}px round 9999px)`);
    });
  }, [value]);

  const itemClass =
    'rounded-full px-4 py-2 text-sm font-medium capitalize whitespace-nowrap transition-colors duration-200';

  return (
    <div className="inset inline-flex max-w-full overflow-x-auto rounded-full p-1">
      <div ref={rowRef} className="relative flex w-max gap-1">
        <div className="flex gap-1" role="tablist" aria-label={label}>
          {tabs.map((t) => (
            <button
              key={t.value}
              data-tab={t.value}
              role="tab"
              aria-selected={t.value === value}
              onClick={() => onChange(t.value)}
              className={`${itemClass} ${
                t.value === value ? 'text-ivory' : 'text-ivory-dim hover:text-ivory'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* The clipped copy. Purely decorative — the buttons above are the real control. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex gap-1"
          style={{
            clipPath: clip,
            transition: ready
              ? 'clip-path 250ms cubic-bezier(0.77, 0, 0.175, 1)'
              : undefined,
          }}
        >
          {tabs.map((t) => (
            <span
              key={t.value}
              className={`${itemClass} text-ink-950`}
              style={{
                background: 'linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
