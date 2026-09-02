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

export interface SetupItem {
  key: string;
  title: string;
  /** What does not work until this is done. */
  blocks: string;
  steps: string[];
  /** Real money, per month, where there is any. */
  cost?: string;
  /** Only shown when the business actually needs it. */
  appliesTo?: 'agency' | 'contractor';
}

export const SETUP_ITEMS: SetupItem[] = [
  {
    key: 'invite_team',
    title: 'Invite the people who need a login',
    blocks: 'Nobody but you can see anything, which is fine until it is not.',
    steps: [
      'Team, under your avatar.',
      'Add their email and pick a role. Owner and admin can change business settings; member cannot.',
      'They get an email with a link. No password to share and nothing for you to set up on their side.',
    ],
  },
  {
    key: 'supabase_pro',
    title: 'Upgrade Supabase to Pro',
    blocks: 'Free projects pause after a week of no activity, and daily backups only exist on Pro. Neither matters until somebody depends on this.',
    cost: '$25 a month',
    steps: [
      'supabase.com, the project, then Settings and Billing.',
      'Upgrade to Pro. It covers every workspace in here, not one each.',
      'Do it the morning somebody else starts using this rather than before.',
    ],
  },
  {
    key: 'stripe',
    title: 'Add Stripe keys',
    blocks: 'Invoices can be sent but not paid by card. Everything else about billing already works.',
    steps: [
      'dashboard.stripe.com, Developers, API keys.',
      'Copy the secret key and the publishable key.',
      'Add them in Vercel as STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, then redeploy.',
      'One account pays one business. If a client needs card payments into their own account, that is Stripe Connect and a separate piece of work.',
    ],
  },
  {
    key: 'google_profile',
    title: 'Claim the Google Business Profile',
    blocks: 'You do not appear in map results, and the profile can be edited by anybody until it is claimed.',
    steps: [
      'Decide first whether to publish an address. If customers do not come to you, choose that you deliver to them and Google hides it.',
      'business.google.com, then claim or create.',
      'Verification is a postcard, about a week. Start it and do the rest while it is in the mail.',
      'The full checklist and the generated address block are in Being found.',
    ],
  },
  {
    key: 'review_link',
    title: 'Set the review link',
    blocks: 'Finished jobs are never asked for a review, which is the cheapest marketing there is.',
    steps: [
      'Needs the Google profile claimed first.',
      'In the profile, Ask for reviews, and copy the link.',
      'Paste it into Business, What you charge.',
      'From then on every finished, paid-up job gets one request automatically.',
    ],
  },
  {
    key: 'email_domain',
    title: 'Send email from your own domain',
    blocks: 'Estimates and invoices arrive from a shared address, which lands in spam more often and reads as somebody else’s software.',
    steps: [
      'resend.com, Domains, add your domain.',
      'Add the DNS records it gives you. SPF, DKIM and DMARC all three, because two out of three still gets filtered.',
      'Set MAIL_FROM in Vercel to the address you want on the envelope.',
    ],
  },
  {
    key: 'default_branch',
    title: 'Change the GitHub default branch to main',
    blocks: 'A stale master branch cannot be deleted while it is the default. Nothing breaks; it is untidiness with a sharp edge.',
    steps: [
      'github.com, the repo, Settings, Branches.',
      'Change the default from master to main.',
      'Then master can be deleted and there is one branch again.',
    ],
  },
];
