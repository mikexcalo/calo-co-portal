/**
 * The brand and messaging framework, as a standard rather than as a document.
 *
 * This is the one copy. Every client gets these ten modules, in this order,
 * and the order is not presentation: each module is an input to the next.
 * Positioning cannot be written before the audience is defined. Identity
 * cannot start before the pillars are locked.
 *
 * Holding it here rather than in any one client's record is the whole point.
 * A framework that lives inside the first project it was used on is not a
 * process, it is a souvenir. Improving a question here improves it for every
 * client from that moment on, including the ones already underway.
 *
 * `asks` earns its place twice. It is the discovery sheet you work from on a
 * call, and it is what the reader hunts for when you paste that call back in.
 * The same list on both sides is deliberate: what you go looking for and what
 * gets pulled out should never drift apart.
 */

export interface FrameworkModule {
  id: string;
  name: string;
  /** The one thing to remember about this module, shown beside the name. */
  note: string;
  job: string;
  how: string[];
  failures: string[];
  /** What to ask a client to fill this in. */
  asks: string[];
}

/**
 * open     nobody has written it yet
 * testing  written, in front of people, not settled
 * locked   decided, and changing it is a decision rather than an edit
 */
export type ModuleState = 'open' | 'testing' | 'locked';

export interface BrandModule extends FrameworkModule {
  state: ModuleState;
  content: string;
  /** Where the content came from, when a reader proposed it. */
  source?: string;
}

export const FRAMEWORK: FrameworkModule[] = [
  {
    id: "brand_idea",
    name: "Brand idea",
    note: "Lock first",
    job: "A single sentence stating the truth your brand exists inside. A point of view about the world, not a claim about your product.",
    how: [
      "One sentence. Under ten words if you can.",
      "It must be true whether or not your company exists. That is what makes it earn the headline.",
      "Write it in the language of the people you serve, not the category.",
      "Test it out loud. If it sounds like a tagline, push again.",
    ],
    failures: [
      "A product claim wearing a philosophy costume.",
      "A universal truth so broad it fits any company.",
      "Something nobody would disagree with and nobody would repeat.",
    ],
    asks: [
      "What does this company actually do, in the words a customer would use?",
      "What did people do before this existed?",
      "Why did the founders start it? The real reason, not the deck reason.",
    ],
  },
  {
    id: "brand_promise",
    name: "Brand promise",
    note: "Lock first",
    job: "The brand idea is a truth you can state. The promise is a commitment you could fail at. It is what changes for the person on the other side.",
    how: [
      "Address the customer directly. Use \"you\".",
      "Describe the change in their life, not the feature that causes it.",
      "It should be falsifiable. If you cannot imagine breaking it, it is not a promise.",
      "It should answer the brand idea, not repeat it.",
    ],
    failures: [
      "A benefit statement with no risk in it.",
      "Promising an outcome the product cannot control.",
      "Restating the brand idea in different words.",
    ],
    asks: [
      "What does a customer get that they could hold you to?",
      "What would count as letting them down?",
    ],
  },
  {
    id: "north_star",
    name: "North Star",
    note: "Internal only",
    job: "One word naming the feeling everything should produce. A decision tool, not copy. It never appears on a page.",
    how: [
      "One word. Not two, not a phrase.",
      "It should settle arguments. When two options are on the table, the one closer to the North Star wins.",
      "Choose a feeling your product can actually deliver.",
    ],
    failures: [
      "Choosing a word the technology cannot honestly deliver.",
      "Choosing a word that flatters you rather than describing them.",
      "Letting it leak onto the website as an eyebrow.",
    ],
    asks: [
      "Where is this going in three years?",
      "What would have to be true for that to happen?",
    ],
  },
  {
    id: "audience",
    name: "Who it's for",
    note: "Lock before positioning",
    job: "Names the account shape, not a persona card. Says who signs, who lives in it, and what breaks to make them start looking.",
    how: [
      "Headline sentence: the buyer, described by their situation rather than their title.",
      "Then a short paragraph covering buyer, champion and trigger.",
      "Say what they are not shopping for. It sharpens the rest of the document.",
      "Avoid firmographics as the whole answer. Situation beats size.",
    ],
    failures: [
      "A persona with a name and a stock photo and no purchase behavior.",
      "Defining by company size only, which tells you nothing about why they buy.",
      "Forgetting the champion, who usually decides whether it sticks.",
    ],
    asks: [
      "Who exactly buys this? Title, company size, what their day looks like.",
      "Who is explicitly not the buyer?",
      "What are they doing today instead?",
    ],
  },
  {
    id: "positioning",
    name: "Positioning statement",
    note: "The load-bearing line",
    job: "One line placing you in a category and saying who it is for. Everything downstream inherits from it. If this is vague, every page you build will be vague.",
    how: [
      "One sentence, plain, no adjectives doing the work.",
      "Name the category in words the buyer would use.",
      "Then a supporting paragraph carrying the against-what: the alternative you displace and why it fails.",
      "Keep the against-what out of the headline sentence. It belongs underneath.",
    ],
    failures: [
      "Listing three nouns. A feature list wearing a sentence.",
      "Inventing a category name nobody searches for.",
      "Naming a competitor directly, which makes them the reference point.",
    ],
    asks: [
      "What category do they put themselves in?",
      "What does this displace, and why does that alternative fail?",
    ],
  },
  {
    id: "tone",
    name: "Tone of voice",
    note: "With rules attached",
    job: "Three adjectives are useless on their own. The value is in the rules underneath them, which are enforceable.",
    how: [
      "A short characterful sentence, then a person you could point at.",
      "Then a list of hard rules: banned words, banned constructions, internal versus external language.",
      "Every rule should be checkable by someone who has never met the brand.",
      "If a rule cannot be violated, it is a preference, not a rule.",
    ],
    failures: [
      "Three adjectives every brand in the category would also choose.",
      "Rules with no teeth, like \"be authentic\".",
      "Letting internal shorthand leak into customer-facing copy.",
    ],
    asks: [
      "How do they talk when they are being themselves?",
      "What words do they use that nobody else in the category uses?",
      "What kind of writing makes them cringe?",
    ],
  },
  {
    id: "pitch",
    name: "The pitch",
    note: "Three lengths",
    job: "The same story at three lengths, so sales, the website and a founder on a call all say the same thing at different speeds.",
    how: [
      "Opening question. Names the tension without naming a competitor.",
      "Elevator pitch. One sentence, plain description, written for speech.",
      "Thirty seconds. Every clause should trace to a pillar. If a clause traces to nothing, cut it.",
    ],
    failures: [
      "Three different stories at three lengths.",
      "An elevator pitch nobody can say out loud without reading it.",
      "A long version that introduces ideas the pillars never support.",
    ],
    asks: [
      "If you had one sentence, what is it?",
      "What is the thirty second version?",
    ],
  },
  {
    id: "pillars",
    name: "Pillars",
    note: "Two or three, never more",
    job: "The repeatable message. Each pillar stands on its own, and together they say the thing no competitor can claim.",
    how: [
      "The claim. A headline an operator would repeat.",
      "In a sentence. What it actually means, plainly.",
      "What that looks like. Three to five concrete moments with real detail, real times, real objects.",
      "Why you would believe it. The cost of the problem plus reasons to believe.",
      "In the product. Internal only. The features that deliver it.",
      "Pillars must be structurally parallel. Same number of parts, same depth.",
      "Read together they should produce a claim neither makes alone. Write that line down.",
    ],
    failures: [
      "Four or five pillars, which means none of them is a pillar.",
      "One pillar with rich proof and one with none, which reveals the weak half.",
      "Abstract moments. \"Improves collaboration\" is not a moment.",
    ],
    asks: [
      "What are the two or three things you say every single time?",
    ],
  },
  {
    id: "proof",
    name: "Proof",
    note: "Status required",
    job: "Holds every quote, statistic and customer logo in one place with its permission status attached. This is the module that stops a placeholder reaching a customer.",
    how: [
      "Every item carries real, placeholder or gap.",
      "Real requires a name, a title, a company and written permission on file.",
      "Gaps are written as the thing you want, so the team knows what to collect.",
      "Numbers need a source and a date, or they are a gap.",
    ],
    failures: [
      "Placeholder quotes that are too good, which is exactly why they ship by accident.",
      "Logos used illustratively that become an implied customer claim.",
      "A number everybody repeats that nobody can source.",
    ],
    asks: [
      "Who would go on record, by name?",
      "Which numbers can you actually source?",
      "Which logos are you cleared to use in public?",
    ],
  },
  {
    id: "guardrails",
    name: "Guardrails",
    note: "Run as a check",
    job: "Two lists, what we say and what we never say. Treat the never list as an automated check run against every asset, not as a page people are expected to remember.",
    how: [
      "Every banned item needs a reason, or it will be argued back in.",
      "Include banned constructions, not just banned words.",
      "Include internal shorthand that must not appear externally.",
      "Re-run the check on every draft, including ones written by people who know the rules.",
    ],
    failures: [
      "A list with no reasons, which gets overruled by whoever is loudest.",
      "Checking only new copy and never the live site.",
      "Letting a working name become a public category name by accident.",
    ],
    asks: [
      "Which words are banned, and why?",
      "What has gone out that you regretted afterwards?",
    ],
  },
];

/**
 * A new client starts empty, not pre-filled.
 *
 * The temptation is to seed plausible placeholder content so the screen looks
 * finished. That is the same failure the proof module exists to prevent: a
 * placeholder is dangerous precisely because it reads well, and one that has
 * been sitting in a field for three weeks stops looking like a placeholder to
 * the person who put it there.
 */
export function blankFramework(): BrandModule[] {
  return FRAMEWORK.map((m) => ({ ...m, state: 'open' as const, content: '' }));
}

/**
 * Bring an existing brand up to the current framework.
 *
 * Written content always wins. Adding a module or rewording a question must
 * never overwrite something a person decided, so this fills gaps and refreshes
 * the guidance around them, and touches nothing else.
 */
export function reconcile(existing: BrandModule[] = []): BrandModule[] {
  const held = new Map(existing.map((m) => [m.id, m]));
  return FRAMEWORK.map((m) => {
    const prev = held.get(m.id);
    return prev
      ? { ...m, state: prev.state, content: prev.content, source: prev.source }
      : { ...m, state: 'open' as const, content: '' };
  });
}

/** How far along a brand is, for a list that has to be scannable. */
export function progress(modules: BrandModule[] = []): {
  locked: number;
  testing: number;
  open: number;
  total: number;
  /** The next module with nothing in it, which is what to work on. */
  next: BrandModule | null;
} {
  const total = FRAMEWORK.length;
  const locked = modules.filter((m) => m.state === 'locked').length;
  const testing = modules.filter((m) => m.state === 'testing').length;
  return {
    locked,
    testing,
    open: total - locked - testing,
    total,
    next: modules.find((m) => !m.content?.trim()) ?? null,
  };
}
