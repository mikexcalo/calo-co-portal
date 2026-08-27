'use client';

/**
 * Guided paths — learn a whole process end to end, not a feature at a time.
 *
 * Each path is one real business workflow broken into steps, and every step
 * links to the actual screen. This is deliberately NOT a product tour with
 * tooltips: you do the real thing on real data, and the panel just tells you
 * where you are and what "done" looks like.
 *
 * Progress is per-browser, in localStorage. It's a teaching aid, not a record
 * worth syncing.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface PathStep {
  id: string;
  title: string;
  /** What to actually do, in plain language. */
  body: string;
  href?: string;
  /** How you know it worked. */
  done?: string;
}

export interface LearningPath {
  id: string;
  name: string;
  blurb: string;
  minutes: number;
  steps: PathStep[];
}

export const PATHS: LearningPath[] = [
  {
    id: 'money-in',
    name: 'Getting paid',
    blurb:
      'The full loop: a lead becomes an estimate, the work gets logged, receipts get filed, and an invoice builds itself.',
    minutes: 12,
    steps: [
      {
        id: 'rates',
        title: 'Set your rates',
        body:
          'Before anything else, set the hourly rate and material markup for this business. They start at zero, which would make every invoice come out at zero.',
        href: '/business',
        done: 'The orange warning banner disappears.',
      },
      {
        id: 'job',
        title: 'Create a job',
        body:
          'Make a job for real work — a customer, an address, and whether it is time & materials or fixed price. A lead and a job are the same record, so start it at whatever stage it is really at.',
        href: '/jobs/new',
        done: 'The job appears on the pipeline board.',
      },
      {
        id: 'estimate',
        title: 'Build an estimate',
        body:
          'Price the work line by line. On a time & materials job this is a forecast — the invoice will come from what actually happens, not from this number.',
        href: '/jobs',
        done: 'The job shows an estimate total.',
      },
      {
        id: 'hours',
        title: 'Log hours against it',
        body:
          'Open the job and log a day of work. This is half of what an invoice gets built from.',
        href: '/jobs',
        done: 'Unbilled goes up, and margin goes negative until you bill.',
      },
      {
        id: 'receipt',
        title: 'Photograph a receipt',
        body:
          'Go to Documents and add a receipt — on a phone the button opens your camera. It gets read automatically: vendor, date, amount. The file itself is kept, which is what you need at tax time.',
        href: '/documents',
        done: 'The receipt shows a vendor and an amount.',
      },
      {
        id: 'file',
        title: 'File it to the job',
        body:
          'Pick the job from the dropdown and file it. The receipt becomes a cost on that job, and the original stays attached to it.',
        href: '/documents',
        done: 'It moves out of the inbox, and the job cost goes up.',
      },
      {
        id: 'invoice',
        title: 'Draft the invoice',
        body:
          'Back on the job, hit the invoice button. Every unbilled hour and filed receipt is swept onto an invoice, with markup applied. You are approving an invoice, not typing one.',
        href: '/jobs',
        done: 'A draft invoice appears with lines traced back to their source.',
      },
      {
        id: 'send',
        title: 'Send it',
        body:
          'Send for payment and the customer gets a payment page. When they pay, the invoice marks itself. Until Stripe is connected, mark it sent by hand — everything else still works.',
        href: '/billing',
        done: 'The invoice leaves draft.',
      },
    ],
  },
  {
    id: 'paperwork',
    name: 'Taming the paperwork',
    blurb:
      'You have a shoebox, a glovebox, and a folder of PDFs. This turns them into filed job costs.',
    minutes: 8,
    steps: [
      {
        id: 'dump',
        title: 'Dump everything in',
        body:
          'Add documents in bulk — receipts, supplier invoices, permits. Each one is read once and never charged for again.',
        href: '/documents',
        done: 'They land in the inbox with vendor and amount filled in.',
      },
      {
        id: 'review',
        title: 'Check what needs eyes',
        body:
          'Anything smudged or ambiguous is flagged "Needs review" instead of being guessed at. A missing number is safer than a wrong one, because a wrong one becomes a wrong invoice.',
        href: '/documents',
        done: 'You know which ones to look at.',
      },
      {
        id: 'cost',
        title: 'Watch the cost',
        body:
          'The page shows exactly what reading these has cost you, in real money. It is about half a cent per document, once. There is no ongoing charge for having them.',
        href: '/documents',
        done: 'The total is a number you can live with.',
      },
      {
        id: 'file-all',
        title: 'File them to jobs',
        body:
          'Each filed document becomes a job cost with the original attached. That is what makes the P&L real rather than a guess.',
        href: '/documents',
        done: 'The inbox is empty.',
      },
    ],
  },
  {
    id: 'know-your-numbers',
    name: 'Knowing your numbers',
    blurb:
      'Which jobs made money, what is owed to you, and what is sitting unbilled right now.',
    minutes: 6,
    steps: [
      {
        id: 'pl',
        title: 'Read the P&L',
        body:
          'Revenue, costs and margin across a period. Every number is built from filed receipts and logged hours, so it is only as honest as your filing.',
        href: '/pl',
        done: 'You can see whether the month made money.',
      },
      {
        id: 'per-job',
        title: 'Find the job that lost money',
        body:
          'The per-job table is the point. Averages hide the one remodel that went sideways; this shows it by name.',
        href: '/pl',
        done: 'You can name your worst job.',
      },
      {
        id: 'unbilled',
        title: 'Find the money you forgot to bill',
        body:
          'Unbilled work is hours and receipts that never made it onto an invoice. For most contractors this is the single biggest leak.',
        href: '/jobs',
        done: 'Unbilled is at zero, or you know why it is not.',
      },
      {
        id: 'owed',
        title: 'Chase what is owed',
        body:
          'Outstanding is invoiced money that has not arrived. Sorted by age, because a 90-day invoice needs a phone call, not another email.',
        href: '/billing',
        done: 'You know who to call.',
      },
    ],
  },
  {
    id: 'clients',
    name: 'Running the agency',
    blurb:
      'The CALO&CO side: clients, engagements, and keeping tabs on the whole book.',
    minutes: 5,
    steps: [
      {
        id: 'switch',
        title: 'Switch businesses',
        body:
          'Use the switcher at the top of the sidebar. CALO&CO and Mammoth are separate books with separate data — the words change too, from Jobs to Engagements.',
        done: 'The sidebar says Engagements.',
      },
      {
        id: 'crm',
        title: 'Add a client',
        body:
          'Clients are who you bill. Everything else hangs off them.',
        href: '/customers',
        done: 'They appear in the list with their engagement count.',
      },
      {
        id: 'engagement',
        title: 'Open an engagement',
        body:
          'An engagement is a unit of work with money in and money out — same machinery as a contractor job, different vocabulary.',
        href: '/jobs/new',
        done: 'It shows on the pipeline.',
      },
    ],
  },
];

const STORAGE_KEY = 'nautilus-tutorial-v1';

interface TutorialState {
  open: boolean;
  activePathId: string | null;
  completed: Record<string, boolean>;
}

interface TutorialContextValue extends TutorialState {
  activePath: LearningPath | null;
  openPanel: () => void;
  closePanel: () => void;
  startPath: (id: string) => void;
  exitPath: () => void;
  toggleStep: (pathId: string, stepId: string) => void;
  progressFor: (pathId: string) => { done: number; total: number };
  resetPath: (pathId: string) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  // Read after mount only — touching localStorage during render would make
  // the server and client disagree, which is exactly the hydration bug that
  // was crashing the old dashboard.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TutorialState>;
        setCompleted(parsed.completed ?? {});
        setActivePathId(parsed.activePathId ?? null);
      }
    } catch {
      // A corrupt value shouldn't take down the app.
    }
  }, []);

  const persist = useCallback((next: Partial<TutorialState>) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...next }));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleStep = useCallback(
    (pathId: string, stepId: string) => {
      const key = `${pathId}:${stepId}`;
      setCompleted((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        persist({ completed: next });
        return next;
      });
    },
    [persist]
  );

  const startPath = useCallback(
    (id: string) => {
      setActivePathId(id);
      setOpen(true);
      persist({ activePathId: id });
    },
    [persist]
  );

  const exitPath = useCallback(() => {
    setActivePathId(null);
    persist({ activePathId: null });
  }, [persist]);

  const resetPath = useCallback(
    (pathId: string) => {
      setCompleted((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (k.startsWith(`${pathId}:`)) delete next[k];
        persist({ completed: next });
        return next;
      });
    },
    [persist]
  );

  const progressFor = useCallback(
    (pathId: string) => {
      const path = PATHS.find((p) => p.id === pathId);
      if (!path) return { done: 0, total: 0 };
      return {
        done: path.steps.filter((s) => completed[`${pathId}:${s.id}`]).length,
        total: path.steps.length,
      };
    },
    [completed]
  );

  return (
    <TutorialContext.Provider
      value={{
        open,
        activePathId,
        completed,
        activePath: PATHS.find((p) => p.id === activePathId) ?? null,
        openPanel: () => setOpen(true),
        closePanel: () => setOpen(false),
        startPath,
        exitPath,
        toggleStep,
        progressFor,
        resetPath,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
  return ctx;
}
