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
    key: 'old_wix_site',
    title: 'Retire mikecalo.co and win your own name on calo.company',
    blocks:
      'Searching your name puts mikecalo.co above calo.company. You have chosen to let the domain lapse on 27 September rather than redirect it, which means the old result goes away on its own but hands nothing to the new site. Everything after that is making calo.company rank for Mike Calo from its own strength.\n\nOne consequence worth knowing rather than discovering: once it lapses, anybody can register mikecalo.co, and the name is yours.',
    steps: [
      'Nothing to renew. Auto renew is already off on both the domain and the Premium plan, so doing nothing is the whole action.',
      'While you still own it, verify mikecalo.co in Search Console and use the Removals tool on it. That takes the old result out of Google in about a day instead of the weeks it takes Google to notice a dead domain. This only works while the domain is still yours.',
      'Unpublish the Wix site now rather than waiting for the plan to expire. A site that returns nothing drops out faster than one that keeps answering.',
      'Verify calo.company in Search Console if you have not. Everything below is measured there, and it keeps no history from before the day you verify.',
      'Put your name in the title of the calo.company home page. Not CALO&CO alone: the query is Mike Calo, and the page has to contain the thing being searched for.',
      'Give yourself a page. An about or founder page that is genuinely about Mike Calo, with the work history, is what ranks for a person. A company home page rarely does.',
      'Add a Person block to calo.company with sameAs pointing at your LinkedIn, and link calo.company from your LinkedIn profile. LinkedIn already outranks both sites for your name, so it is the strongest signal you control, and it is now the only inherited authority you have.',
      'Expect this to be slower than a redirect would have been. You are building name authority from nothing rather than moving it across, so think months and keep the Search Console position graph as the measure.',
    ],
  },
  {
    key: 'search_console',
    title: 'Verify the site in Google Search Console',
    blocks:
      'No record of which searches find you, what position you hold, or what people clicked. It only keeps data from the day you verify, so every day this is off is a day that cannot be recovered later.',
    steps: [
      'search.google.com/search-console, add a property, and choose Domain rather than URL prefix so subdomains are covered.',
      'Add the TXT record it gives you at your registrar. Verification usually lands within the hour.',
      'Submit the sitemap once it verifies.',
      'Do this before the Wix redirect, not after. Having both the before and after is how you can tell whether the redirect worked.',
    ],
  },
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
      'The full checklist and the generated address block are in Digital, under Search.',
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
