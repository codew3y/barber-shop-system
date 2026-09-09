'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How does the downpayment work?',
    a: '20% holds your chair and comes straight off your total at the shop. No-shows forfeit it — that keeps chairs honest for everyone.',
  },
  {
    q: 'Can I move or cancel my booking?',
    a: 'Anytime from your dashboard, no calls needed. Your slot frees up instantly for someone else.',
  },
  {
    q: 'What if I run late?',
    a: 'Your chair holds for 15 minutes past start. After that it releases and the visit counts as a no-show.',
  },
  {
    q: 'Do you take walk-ins?',
    a: 'Wherever the queue allows — but booked chairs come first. Reserving takes under a minute.',
  },
];

// State-indication motion: height + opacity transition on expand.
// Occasional interaction, well inside budget.
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mt-24">
      <p className="eyebrow">Good to know</p>
      <h2 className="font-display mt-3 text-4xl sm:text-5xl">Questions, answered</h2>
      <ul className="mt-8 grid gap-2.5">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.q} className="card !p-0">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="font-medium">{f.q}</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-brass-300 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="muted px-5 pb-4 text-sm leading-relaxed">{f.a}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
