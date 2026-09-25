/*
  TITLES SAY WHAT IS WRONG. THE PANEL SAYS WHY AND WHAT TO DO.

  These were written as instructions — "Let replies come back", "Set the review
  link", "Claim the Google Business Profile" — which reads as a riddle on a
  list you are scanning: you have to already know what the thing is to know
  whether it matters. Half of them are not even obviously problems.

  A title now states the problem in the reader's terms. "Email replies do not
  reach the platform" is checkable in a glance; "Let replies come back" is a
  puzzle. What it means, why it matters and the steps are behind How, which is
  where somebody goes once they have decided it is worth their morning.
*/

/**
 * What the owner owes the platform.
 *
 * Stripe keys, the Supabase upgrade, inviting somebody, the Google profile.
 * Every one of these has lived in a chat message that scrolled away, which is
 * why the same question keeps getting asked.
 *
 * The steps matter as much as the item. These do not get postponed because
 * they are hard, they get postponed because nobody remembers which screen the
 * button is on, and looking it up costs more than the task.
 *
 * `blocks` is the honest part. An item nobody can name a consequence for is an
 * item that should not be nagging anybody, and writing the consequence down is
 * what stops this list growing into a wall of vague good intentions.
 */

import type { IconName } from '@/components/spine/icons';

export interface SetupItem {
  key: string;
  /**
   * Only shown to one workspace.
   *
   * A tester's brief is not a task for everybody, and putting it in the shared
   * list would mean every future client is told to go and break things.
   */
  onlyOrg?: string;
  title: string;
  /** What does not work until this is done. */
  blocks: string;
  steps: string[];
  /** Recognized rather than read, so the list can be scanned. */
  icon: IconName;
  /**
   * Something already built is sitting broken until this is done.
   *
   * Deliberately rare. If three things are urgent then nothing is, and the
   * label stops meaning anything the second time it is used loosely.
   */
  urgent?: boolean;
  /**
   * Maintenance of the platform itself, not of a business using it.
   *
   * Every item in this file is one of these: a GitHub default branch, a
   * Supabase plan that pauses when idle, DNS for inbound mail, whether
   * sending has been tested end to end. None of it is work a roofer or a
   * studio owner would ever do, and two of them name real clients.
   *
   * They were showing on every workspace's Home, six at a time, several
   * marked URGENT. Flagged so they stay with whoever builds this.
   */
  platformOnly?: true;
  /** Real money, per month, where there is any. */
  cost?: string;
  /** Only shown when the business actually needs it. */
  appliesTo?: 'agency' | 'contractor';
  /**
   * Who this is actually for.
   *
   * Marcie opened Lakemere and was asked how she charges and how she wants to
   * be paid. She charges nobody. This was the owner's list being shown to
   * whoever happened to be standing there, which is the same mistake the
   * welcome flow made before it branched.
   *
   * Absent means everybody.
   */
  forRoles?: string[];
}

export const SETUP_ITEMS: SetupItem[] = [
  {
    key: 'tester_brief',
    platformOnly: true,
    onlyOrg: 'lakemere',
    forRoles: ['looking', 'delivery'],
    title: 'What we are actually asking you to do',
    icon: 'brief',
    urgent: true,
    blocks:
      'This is a real workspace, not a demo. Nothing you type here reaches a customer, nothing sends, and nothing is precious. Break it.\n\nWhat is genuinely useful back is not a bug list. It is the moments where you knew what you wanted and could not find it, or where a screen told you something and you did not believe it. Those are the expensive problems and they are invisible from the inside.',
    steps: [
      'Run it as the business for twenty minutes. Add a couple of clients, put an engagement against one, raise an invoice. Do it the way you would if it were real, not the way you think it wants.',
      'Say out loud what you expected before you click. Where the thing that happened is not the thing you expected, that gap is the finding.',
      'Take the walkthrough in [Learn](/learn) and time yourself. It reports how long it took at the end. If it is longer than you would sit through, say so.',
      'Turn things off in [Setup, What you see](/what-you-see). The sidebar starts with nine rows; decide which ones a services business would actually open and which are noise.',
      'Find the places the words are wrong. Labels that read like software rather than like the job, headings that need reading twice, anything that made you pause.',
      'Write it all down in [Capture](/notes) as you go, not afterwards. It files against the workspace and we read it. Afterwards is where the useful half gets forgotten.',
      'Where you would rather build than describe, say so and we will get you the repo. It runs on Next.js and Supabase, and every pull request gets its own live URL, so you can put something real in front of us without touching anything live.',
    ],
  },
  {
    key: 'test_send',
    platformOnly: true,
    forRoles: ['owner', 'admin', 'finance'],
    title: 'Sending has never been tested end to end',
    icon: 'send',
    urgent: true,
    blocks:
      'Two minutes, and it settles whether the whole email path works.\n\ncalo.company is verified and the from address is set, so this should now arrive from your own domain rather than a shared one. Nothing about it has been proved end to end, and a feature nobody has watched work is a feature you should not point at a client.\n\nIf it lands, sending is done and only replies are missing. If it does not, that is worth knowing before Frank is the one who finds out.',
    steps: [
      'Switch to Demo, top left, so nothing real is involved.',
      'Open any client. Foldwork has a brief and three tasks on it, so it has the most to write from.',
      'Press the line that offers to draft an email. To will already say Mike Calo (you) with your own address next to it.',
      'Read what it wrote, then press Email Mike Calo.',
      'Check your inbox, and spam. Which folder it lands in tells you whether the DNS records are doing their job.',
    ],
  },
  {
    key: 'email_domain',
    platformOnly: true,
    forRoles: ['owner', 'admin', 'finance'],
    title: 'Email replies do not reach the platform',
    icon: 'mail',
    urgent: true,
    blocks:
      'Sending already works. calo.company is verified with Resend: the DKIM record is on resend._domainkey, the SPF and bounce records are on send.calo.company, and the from address is set. Anything this platform writes can leave.\n\nWhat is missing is the other direction. Reply to one of those emails and it goes to whatever inbox the from address points at, and this platform never hears about it. So a client answering you cannot move them to Talking, cannot clear the waiting flag, and cannot appear on their record.\n\nOne DNS record and one webhook. The code for both has been sitting finished for days.',
    steps: [
      'Prove sending first. Open any client, draft an update, and send it to yourself. If it arrives, everything below is the only thing left.',
      'In [Resend](https://resend.com/domains), open Receiving and add the subdomain in.calo.company. It gives you one MX record.',
      'Put that MX into [Vercel DNS](https://vercel.com/mikexcalo-7384s-projects/~/domains/calo.company). The subdomain, never the root: an MX on calo.company itself would send all your mail to Resend instead of your inbox.',
      'Still in Resend, add a webhook for the email.received event pointing at https://nautilusapp.vercel.app/api/mail/inbound',
      'Send me the webhook signing secret and tell me the MX is in. I set MAIL_INBOUND_DOMAIN and RESEND_WEBHOOK_SECRET, which is the last step and it is mine.',
      'Then reply to your own test email and watch it file itself against the client and move them to Talking without you touching anything.',
    ],
  },
  /*
    'old_wix_site' lived here: nine steps to renew mikecalo.co, move its
    nameservers off Wix to Vercel, stand up a 308 and keep paying for a year
    so Google could walk the signals across.

    It is gone because the decision went the other way. The old site is four
    pages, two of them Wix template leftovers, and a redirect only passes
    anything while somebody can still follow it — which is why Google asks
    for a year, which means buying a domain you do not want in order to
    inherit an abandoned one. Changing the single link on Stevie's site
    catches everything that actually points at it.

    Leaving it here left Home telling you to renew and Digital telling you to
    let it lapse, in the same product, about the same domain, four days out.
    The plan is one plan, and it lives in DIGITAL_PLAN.
  */
  {
    key: 'invite_team',
    platformOnly: true,
    forRoles: ['owner', 'admin'],
    title: 'Nobody else can sign in yet',
    icon: 'people',
    blocks:
      'You are the only person who can see any of this, which is fine right up until it is not.\n\nMark is the live one. He has a workspace, his own client list and his own invoices sitting in here, and no way to open them, so everything you have built for Mammoth reaches him by you describing it. The invite is what turns this from something you show people into something they use.\n\nWorth doing after the email domain, not before. An invite from a shared address to a product he has never heard of reads exactly like phishing, and you only get one first impression of a login screen.',
    steps: [
      'Team, under your avatar.',
      'Add their email and pick a role. Owner and admin can change business settings; member cannot.',
      'They get an email with a link. No password to share and nothing for you to set up on their side.',
    ],
  },
  {
    key: 'supabase_pro',
    platformOnly: true,
    forRoles: ['owner'],
    title: 'The database pauses itself after a week idle',
    icon: 'records',
    blocks:
      'There are no backups of any of this, and the database sleeps if nobody touches it for a week.\n\nEvery client, brief, invoice, note and logo lives in one free Supabase project. Free projects get no daily backups at all, so a bad migration or a deleted row is gone with nothing to restore from. They also pause after seven idle days, which means the first person to open the portal after a quiet week finds it down.\n\nNeither has bitten yet because you are in here daily and nobody else depends on it. Both start mattering the morning Mark logs in. This is the only item on the list I cannot do for you, because it needs your card.',
    cost: '$25 a month',
    steps: [
      'Open [the Supabase project](https://supabase.com/dashboard/project/qwncdybiluseypcovitd/settings/billing).',
      'Upgrade to Pro. It covers every workspace in here, not one each.',
      'Do it the morning somebody else starts using this rather than before.',
    ],
  },
  {
    key: 'stripe',
    platformOnly: true,
    forRoles: ['owner', 'admin', 'finance'],
    title: 'Clients cannot pay an invoice by card',
    icon: 'card',
    blocks:
      'Invoices can be raised and sent, and then not paid by card.\n\nEverything else about billing already works: line items, totals, what has been collected, what is owed, and the reminder when something goes past due. The gap is only the Pay button, so today a client either sends a transfer or you chase them by hand.\n\nYou deferred this and that is still reasonable. Card payments cost roughly three percent, and at your volume a Venmo or a transfer costs nothing. This becomes worth it when a client asks to pay by card rather than when you feel behind for not having it.',
    /*
      These steps were wrong in two ways.

      They pointed at the calo-co-portal Vercel project, which has had no push
      in months — the same stale project the tracking tag pointed at. Anything
      added there would have sat in a dead environment while the live app went
      on without it.

      And they asked for NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, which no code in
      this repo reads. Nautilus never mounts Stripe's browser SDK; it creates
      a hosted invoice server-side and sends the link. The publishable key has
      nothing to do and asking for it makes the real step look optional.

      The webhook is the part that was missing entirely. Without it an invoice
      paid by card stays open in here forever, which is worse than no card
      payments at all.
    */
    steps: [
      'Open [Stripe API keys](https://dashboard.stripe.com/apikeys) and copy the secret key. Only the secret key — nothing here uses a publishable one.',
      'Add it in [Vercel, project nautilus](https://vercel.com/mikexcalo-7384s-projects/nautilus/settings/environment-variables) as STRIPE_SECRET_KEY, Production.',
      'In [Stripe webhooks](https://dashboard.stripe.com/webhooks), add an endpoint at https://nautilusapp.vercel.app/api/stripe/webhook and subscribe it to invoice.paid, invoice.payment_failed, invoice.updated and invoice.voided.',
      'Copy that endpoint\u2019s signing secret and add it as STRIPE_WEBHOOK_SECRET, also Production. Without it every webhook is rejected and a card payment never marks the invoice paid.',
      'Redeploy, then send yourself a test invoice and pay it with 4242 4242 4242 4242 in test mode.',
      'One account pays one business. If a client needs card payments into their own account, that is Stripe Connect and a separate piece of work.',
    ],
  },
  /*
    'search_console', 'google_profile' and 'review_link' lived here.

    All three were steps in DIGITAL_PLAN already — name_console, the whole map
    track, and map_review. Home listed them as "You cannot see what people
    search to find you", "You do not appear in Google Maps" and "Finished jobs
    are never asked for a review"; Digital listed the same work, in order,
    with boxes that remember. google_profile's own last step said "the full
    checklist is in Digital, under Search", which is a task admitting it is a
    signpost to the real list.

    Two of anything is the problem. Ticking one did nothing to the other, so
    Home kept asking for work already marked done on Digital.

    The plan is DIGITAL_PLAN. Home keeps the tasks that are not in it —
    email replies, Stripe, the team invite — and the Digital row carries the
    rest.
  */
  {
    key: 'default_branch',
    platformOnly: true,
    forRoles: ['owner'],
    title: 'GitHub still defaults to a stale branch',
    icon: 'layers',
    blocks:
      'Nothing is broken today, and this is the least urgent thing on the list.\n\nEvery change goes to main and main is what deploys. The old master branch still exists, still holds an outdated copy of the code, and cannot be deleted while GitHub treats it as the default. The sharp edge is later: anybody who clones this, including future me, lands on master by default and reads code that has not been true for months.',
    steps: [
      'Open [the repo branch settings](https://github.com/mikexcalo/calo-co-portal/settings/branches).',
      'Change the default from master to main.',
      'Then master can be deleted and there is one branch again.',
    ],
  },
];
