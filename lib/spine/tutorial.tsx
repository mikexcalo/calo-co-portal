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
  /**
   * Only for people who can change the business.
   *
   * "Set your hourly rate" was shown to Marcie, who helps Keith out and does
   * not work for Lakemere. It is not her rate, it is not her decision, and the
   * word "your" made the whole walkthrough read as somebody else's post.
   */
  ownerOnly?: boolean;
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
    id: 'first-week',
    name: 'Start here',
    blurb:
      'The things worth doing once. About twenty minutes.',
    minutes: 20,
    steps: [
      {
        id: 'rate',
        ownerOnly: true,
        title: 'Set your hourly rate and markup',
        body:
          'Your hourly rate and the percentage you add to materials. Both start at zero.',
        href: '/business',
        done: 'The orange warning on the dashboard is gone.',
      },
      {
        id: 'prices',
        ownerOnly: true,
        title: 'Load your price list',
        body:
          'Drop in a price sheet you already have. A PDF or a photo works. Check the lines before saving.',
        href: '/pricing',
        done: 'Your standard items appear under Price list.',
      },
      {
        id: 'customer',
        title: 'Add a customer',
        body:
          'One real homeowner or GC you are working with. Their email matters — you cannot send them an invoice without it.',
        href: '/customers',
        done: 'They show in your customer list.',
      },
      {
        id: 'first-job',
        title: 'Create your first job',
        body:
          'A real one you are working on. Name it how you would say it out loud.',
        href: '/jobs/new',
        done: 'It appears on the pipeline board.',
      },
      {
        id: 'log-day',
        title: 'Log a day of work',
        body:
          'Open the job and put in a day you worked — hours, who did it, what got done. This shows up on the invoice.',
        href: '/jobs',
        done: 'Unbilled goes up on the job.',
      },
      {
        id: 'receipt',
        title: 'Photograph a receipt',
        body:
          'On a phone, open Receipts and use the camera button. It reads the vendor, date and total. You check it before it saves.',
        href: '/documents',
        done: 'The receipt shows a vendor and an amount.',
      },
      {
        id: 'file-it',
        title: 'File that receipt to the job',
        body:
          'Pick the job from the dropdown and hit File. It becomes a cost on that job with the photo attached.',
        href: '/documents',
        done: 'The inbox is empty and the job cost went up.',
      },
      {
        id: 'invoice',
        title: 'Build an invoice from it',
        body:
          'Back on the job, hit the invoice button. Unbilled hours and receipts become lines. You approve it before it sends.',
        href: '/jobs',
        done: 'A draft invoice exists with lines you recognize.',
      },
      {
        id: 'phone',
        title: 'Put it on your phone',
        body:
          'Open the site on your phone and add it to your home screen. Share, then Add to Home Screen.',
        done: 'There is an icon on your home screen.',
      },
    ],
  },
  {
    id: 'money-in',
    name: 'Getting paid',
    blurb:
      'The full loop: a lead becomes an estimate, the work gets logged, receipts get filed, and an invoice builds itself.',
    minutes: 12,
    steps: [
      {
        id: 'rates',
        ownerOnly: true,
        title: 'Set your rates',
        body:
          'Set the hourly rate and material markup for this business. They start at zero.',
        href: '/business',
        done: 'The orange warning banner disappears.',
      },
      {
        id: 'job',
        title: 'Create a job',
        body:
          'Make a job for real work: a customer, an address, and whether it is time & materials or fixed price.',
        href: '/jobs/new',
        done: 'The job appears on the pipeline board.',
      },
      {
        id: 'estimate',
        title: 'Build an estimate',
        body:
          'Price the work line by line. On time & materials the invoice comes from what actually happens, not this number.',
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
          'Open Receipts and add one. Drag it in, or use the camera on a phone. Check what it read before saving.',
        href: '/documents',
        done: 'The receipt shows a vendor and an amount.',
      },
      {
        id: 'file',
        title: 'File it to the job',
        body:
          'Pick the job from the dropdown and file it. It becomes a cost on that job.',
        href: '/documents',
        done: 'It moves out of the inbox, and the job cost goes up.',
      },
      {
        id: 'invoice',
        title: 'Draft the invoice',
        body:
          'Back on the job, hit the invoice button. Unbilled hours and filed receipts are swept onto one invoice.',
        href: '/jobs',
        done: 'A draft invoice appears with lines traced back to their source.',
      },
      {
        id: 'send',
        title: 'Send it',
        body:
          'Send it, and the customer gets a payment page. You can also mark it sent by hand.',
        href: '/billing',
        done: 'The invoice leaves draft.',
      },
    ],
  },
  {
    id: 'paperwork',
    name: 'Taming the paperwork',
    blurb:
      'Turning a pile of receipts into filed job costs.',
    minutes: 8,
    steps: [
      {
        id: 'dump',
        title: 'Dump everything in',
        body:
          'Drag a pile in at once. Each one stops for you to approve.',
        href: '/documents',
        done: 'They land in the inbox with vendor and amount filled in.',
      },
      {
        id: 'review',
        title: 'Check what needs eyes',
        body:
          'Nothing saves until you approve it. Anything unreadable is left blank rather than guessed.',
        href: '/documents',
        done: 'You know which ones to look at.',
      },
      {
        id: 'cost',
        title: 'Watch the cost',
        body:
          'The page shows what reading these has cost, in real money.',
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
          'Revenue, costs and margin across a period.',
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
          'Hours and receipts that never made it onto an invoice.',
        href: '/jobs',
        done: 'Unbilled is at zero, or you know why it is not.',
      },
      {
        id: 'owed',
        title: 'Chase what is owed',
        body:
          'Invoiced money that has not arrived, oldest first.',
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
          'Use the switcher at the top of the sidebar. Each business is a separate set of books, and the words change with it.',
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
