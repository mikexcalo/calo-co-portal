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
    title: 'Retire mikecalo.co, and see what people actually search',
    blocks:
      'The domain lapses on 27 September rather than being redirected, so the old result goes and hands nothing across.\n\nCheck the premise first. A search for Mike Calo run without your account returns an actor on IMDb, an Irish basketball player, a college pitcher and two data broker pages, and neither of your sites is in the top ten. Your LinkedIn is. The number two spot you see is probably your own history.\n\nNothing is technically wrong: robots.txt allows everything, the sitemap lists both pages, the founder page is linked from the home page and its title reads Mike Calo. This is an authority problem on a two page domain, not a configuration one.',
    steps: [
      'Ten seconds, and it decides whether the rest matters: open a private window and [search your name](https://www.google.com/search?q=mike+calo). If mikecalo.co is not there, it was never competing with anybody but you.',
      'Verify calo.company. Open [Search Console](https://search.google.com/search-console), Add property, choose Domain, and type calo.company. Everything below needs this and it keeps no history from before the day you do it.',
      'Google gives you a TXT record. Put it in [Vercel DNS for calo.company](https://vercel.com/mikexcalo-7384s-projects/~/domains/calo.company) as Type TXT, Name @, Value the string it gave you. The nameservers are already Vercel\u2019s, so this takes a minute.',
      'Back in Search Console, press Verify, then submit sitemap.xml under Sitemaps. It already exists and lists both pages.',
      'Use URL Inspection on [the founder page](https://calo.company/mike-calo) and press Request Indexing. This is the payoff: it tells you whether Google knows that page exists, which neither of us currently knows.',
      'Unpublish the Wix site. [Wix domains](https://manage.wix.com/account/domains), or in the editor the menu is Site then Unpublish. Two minutes, and worth it because a live outdated site with your name on it is a liability, not because it moves rankings.',
      'Nothing to renew. Auto renew is already off on both the domain and the plan, so doing nothing is the whole action.',
      'Add Person structured data to the founder page with sameAs pointing at [your LinkedIn](https://www.linkedin.com/in/mikecalo/). The page carries two JSON-LD blocks and both describe the company. This is the highest value item here.',
      'Link calo.company from that LinkedIn profile. Schema on one end, a link on the other, is what lets Google treat the profile and the page as one person and lend the new domain what the profile already has.',
      'Skip the Removals tool on mikecalo.co unless the private window proved it is really competing. It means verifying a domain you are abandoning to speed up something that disappears by itself in three weeks.',
    ],
  },
  {
    key: 'search_console',
    title: 'Verify the site in Google Search Console',
    blocks:
      'No record of which searches find you, what position you hold, or what people clicked. It only keeps data from the day you verify, so every day this is off is a day that cannot be recovered later.',
    steps: [
      'Open [Search Console](https://search.google.com/search-console), add a property, and choose Domain rather than URL prefix so subdomains are covered.',
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
      'Open [the Supabase project](https://supabase.com/dashboard/project/qwncdybiluseypcovitd/settings/billing).',
      'Upgrade to Pro. It covers every workspace in here, not one each.',
      'Do it the morning somebody else starts using this rather than before.',
    ],
  },
  {
    key: 'stripe',
    title: 'Add Stripe keys',
    blocks: 'Invoices can be sent but not paid by card. Everything else about billing already works.',
    steps: [
      'Open [Stripe API keys](https://dashboard.stripe.com/apikeys).',
      'Copy the secret key and the publishable key.',
      'Add them in [Vercel environment variables](https://vercel.com/mikexcalo-7384s-projects/calo-co-portal/settings/environment-variables) as STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, then redeploy.',
      'One account pays one business. If a client needs card payments into their own account, that is Stripe Connect and a separate piece of work.',
    ],
  },
  {
    key: 'google_profile',
    title: 'Claim the Google Business Profile',
    blocks: 'You do not appear in map results, and the profile can be edited by anybody until it is claimed.',
    steps: [
      'Decide first whether to publish an address. If customers do not come to you, choose that you deliver to them and Google hides it.',
      'Open [Google Business Profile](https://business.google.com/), then claim or create.',
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
      'Open [Resend domains](https://resend.com/domains) and add your domain.',
      'Add the DNS records it gives you. SPF, DKIM and DMARC all three, because two out of three still gets filtered.',
      'Set MAIL_FROM in Vercel to the address you want on the envelope.',
    ],
  },
  {
    key: 'default_branch',
    title: 'Change the GitHub default branch to main',
    blocks: 'A stale master branch cannot be deleted while it is the default. Nothing breaks; it is untidiness with a sharp edge.',
    steps: [
      'Open [the repo branch settings](https://github.com/mikexcalo/calo-co-portal/settings/branches).',
      'Change the default from master to main.',
      'Then master can be deleted and there is one branch again.',
    ],
  },
];
