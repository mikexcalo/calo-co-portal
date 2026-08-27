/**
 * Answers — a searchable help index that costs nothing to run.
 *
 * Deliberately NOT a model call. Every question here is one somebody actually
 * asks about this app, written out in advance, matched by keyword. It never
 * hallucinates, it works offline, and asking it a thousand times costs the
 * same as asking it once: nothing.
 *
 * The tradeoff is honest: it only knows what's written here. When it doesn't
 * match, it says so rather than inventing an answer.
 */

export interface Answer {
  id: string;
  question: string;
  /** Extra words that should match this answer but aren't in the question. */
  keywords: string[];
  body: string;
  href?: string;
  hrefLabel?: string;
}

export const ANSWERS: Answer[] = [
  {
    id: 'add-receipt',
    question: 'How do I add a receipt?',
    keywords: ['receipt', 'upload', 'photo', 'scan', 'expense', 'material', 'add', 'camera'],
    body: `Go to Documents and hit "Add documents". On a phone there's a button at the bottom of the screen that opens your camera directly — photograph the receipt where you're standing.

It gets read automatically: vendor, date, amount. Then pick the job from the dropdown and hit File. That turns it into a cost on that job, with the original photo kept alongside it.`,
    href: '/documents',
    hrefLabel: 'Open Documents',
  },
  {
    id: 'receipt-cost',
    question: 'Does reading receipts cost money?',
    keywords: ['cost', 'price', 'fee', 'charge', 'expensive', 'billing', 'api', 'token', 'money'],
    body: `About half a cent per document, once. A thousand receipts is roughly five dollars, total, ever.

It's a one-time cost per file — opening it again next year is free. The Documents page shows exactly what you've spent so far, measured, not estimated.

Nothing else in Nautilus costs anything to run. There's no search-the-documents feature precisely because that would charge you every time you asked a question.`,
    href: '/documents',
    hrefLabel: 'See the running total',
  },
  {
    id: 'invoice-zero',
    question: 'Why is my invoice $0?',
    keywords: ['zero', '0', 'invoice', 'empty', 'nothing', 'rate', 'wrong', 'total'],
    body: `Your hourly rate is probably still set to zero. It starts that way on purpose — a rate of $0 makes an obviously broken invoice, which is safer than a made-up number that looks plausible.

Go to Business and set the hourly rate and material markup for this business.`,
    href: '/business',
    hrefLabel: 'Set your rates',
  },
  {
    id: 'create-invoice',
    question: 'How do I create an invoice?',
    keywords: ['invoice', 'bill', 'create', 'draft', 'charge', 'send'],
    body: `You don't write one — you approve one.

Open the job. If there are unbilled hours or filed receipts, the button at the top says how much is waiting. Hit it, and everything unbilled becomes invoice lines, with markup applied to materials.

Each line remembers which receipt or which logged hours produced it, so when a customer questions a charge you can show them.`,
    href: '/jobs',
    hrefLabel: 'Open Jobs',
  },
  {
    id: 'unbilled',
    question: 'What does "unbilled" mean?',
    keywords: ['unbilled', 'outstanding', 'owed', 'difference', 'meaning'],
    body: `Unbilled is work you've done but never charged for — hours logged and receipts filed that haven't made it onto an invoice yet. For most contractors this is the single biggest leak.

Owed to you is different: that's money you HAVE invoiced but haven't been paid. One needs an invoice, the other needs a phone call.`,
    href: '/pl',
    hrefLabel: 'See both',
  },
  {
    id: 'tm-vs-fixed',
    question: 'What is the difference between T&M and fixed price?',
    keywords: ['t&m', 'tm', 'time', 'materials', 'fixed', 'price', 'billing', 'type', 'estimate'],
    body: `On fixed price, the estimate is a promise. The invoice repeats it, and if the job costs more than expected, that comes out of your margin.

On time & materials, the estimate is only a forecast. The invoice is built from what actually happened — real hours, real receipts. That's why filing receipts matters so much on T&M jobs: the paperwork IS the bill.`,
  },
  {
    id: 'log-hours',
    question: 'How do I log hours?',
    keywords: ['hours', 'time', 'labor', 'log', 'track', 'worked', 'day'],
    body: `Open the job, find the Hours section, and hit "Log hours". Put in the date, how many hours, the rate, who did the work, and what they did.

The description shows up on the invoice, so "Framed the bathroom wall" reads a lot better to a customer than "Labor".`,
    href: '/jobs',
    hrefLabel: 'Open Jobs',
  },
  {
    id: 'lead-vs-job',
    question: 'Where do leads go?',
    keywords: ['lead', 'enquiry', 'inquiry', 'contact', 'form', 'new', 'prospect'],
    body: `A lead IS a job — it just sits at the "Lead" stage of the pipeline. There's no separate leads list to keep in sync.

When someone fills in your website form, they arrive as a customer plus a job at the Lead stage, already on the board. You move it right as it progresses.`,
    href: '/jobs',
    hrefLabel: 'See the pipeline',
  },
  {
    id: 'margin-negative',
    question: 'Why is my margin negative?',
    keywords: ['margin', 'negative', 'losing', 'red', 'profit', 'loss', 'minus'],
    body: `That's usually normal on a live job. You buy materials before you invoice, so margin goes negative and then recovers when you bill.

It only matters once a job is complete. On the P&L page, anything still negative after completion is a job that genuinely lost money.`,
    href: '/pl',
    hrefLabel: 'Open P&L',
  },
  {
    id: 'switch-business',
    question: 'How do I switch between businesses?',
    keywords: ['switch', 'business', 'org', 'company', 'change', 'account', 'toggle'],
    body: `Use the switcher at the top of the sidebar, under the Nautilus name. The colored dot tells you which one you're in.

Each business has completely separate data. The words change too — a "Job" in one is an "Engagement" in the other.`,
  },
  {
    id: 'get-paid',
    question: 'How do customers pay me?',
    keywords: ['paid', 'payment', 'stripe', 'card', 'pay', 'collect', 'money in'],
    body: `Once Stripe is connected, "Send for payment" emails the customer a payment page. They pay by card or bank transfer, and the invoice marks itself paid.

Until then, "Mark sent by hand" and "Mark paid" work fine — you just have to remember to press them.`,
    href: '/billing',
    hrefLabel: 'Open Billing',
  },
  {
    id: 'needs-review',
    question: 'What does "Needs review" mean on a document?',
    keywords: ['needs review', 'review', 'flag', 'amber', 'warning', 'smudged', 'unclear'],
    body: `Something on it couldn't be read confidently — a smudged total, a cut-off date, an ambiguous vendor.

When that happens the value is left blank rather than guessed. A blank prompts you to look; a wrong number quietly becomes a wrong invoice.`,
    href: '/documents',
    hrefLabel: 'Open Documents',
  },
  {
    id: 'website-change',
    question: 'How do I get my website changed?',
    keywords: ['website', 'site', 'change', 'update', 'edit', 'request', 'web'],
    body: `Open "Your website". Some things — phone number, hours, headline text — you can edit yourself and they go live immediately.

Anything bigger, hit "Request a change" and describe what you want. You'll see its status the whole way through, so you never have to chase it.`,
    href: '/website',
    hrefLabel: 'Open Your website',
  },
  {
    id: 'email-signature',
    question: 'How do I make an email signature?',
    keywords: ['signature', 'email', 'gmail', 'outlook', 'apple mail', 'sig', 'footer'],
    body: `Brand Kit → Email signature. Fill in your details, pick a layout, then hit "Copy signature".

Then pick your email app from the row of buttons for step-by-step instructions — they're different for each one, and each has a specific trap. Apple Mail needs a checkbox unticked; iPhone needs a shake-to-undo trick.`,
    href: '/brand-kit',
    hrefLabel: 'Open Brand Kit',
  },
];

export interface Match {
  answer: Answer;
  score: number;
}

const STOP = new Set([
  'how','do','i','the','a','an','is','it','to','my','me','can','what','where','why',
  'in','on','of','for','and','this','that','get','does','with','are','be','you','when',
]);

/**
 * Keyword scoring. Crude on purpose: predictable beats clever when the whole
 * point is that it never surprises you with a made-up answer.
 */
export function search(query: string): Match[] {
  const terms = query
    .toLowerCase()
    .replace(/[^\w\s&]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

  if (terms.length === 0) return [];

  const matches: Match[] = [];

  for (const answer of ANSWERS) {
    const haystack = `${answer.question} ${answer.keywords.join(' ')}`.toLowerCase();
    const bodyHay = answer.body.toLowerCase();
    let score = 0;

    for (const t of terms) {
      if (answer.keywords.some((k) => k === t)) score += 10;
      else if (haystack.includes(t)) score += 5;
      else if (bodyHay.includes(t)) score += 1;
    }

    if (score > 0) matches.push({ answer, score });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
