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
    title: 'Keep mikecalo.co, then redirect it to calo.company',
    blocks:
      'The domain registration expires 27 September with auto renew off. Wix says plainly that after that the site goes down and the domain enters redemption at a hundred dollars to recover, and if it drops entirely somebody else can register your own name. Everything else here needs the domain alive, because you cannot redirect one you do not own.\n\nAfter that: searching your name puts mikecalo.co above calo.company, and the Wix site wins on age and inbound links, so the new site cannot get past it while both are live.',
    steps: [
      'Extend the domain registration in Wix today. Settings, Domains, then Extend Registration in the yellow box. A .co is roughly twenty five to forty dollars a year and it is your own name.',
      'Do not confuse the two warnings. The domain registration expires 27 September and you must keep it. The Premium plan expires 28 September and you should let it lapse, but only after the redirect works. Wix keeps serving DNS for domains registered with them without a Premium plan.',
      'Verify calo.company in Search Console. It keeps no history from before verification, and having the before is the only way to know this worked.',
      'In Vercel, open the portal project, Settings, Domains, and add mikecalo.co. It prints the exact A record and CNAME to use.',
      'Back in Wix: Settings, Domains, the three dots next to mikecalo.co, then the DNS or Advanced settings. Put Vercel\u2019s records in there. Do not disconnect the domain first, because disconnecting can take away the panel you need.',
      'Wait for DNS to take. Usually minutes, occasionally a few hours.',
      'Add a permanent redirect from mikecalo.co to calo.company. Permanent, not temporary: a 302 tells Google to keep the old URL indexed, which is the opposite of the point.',
      'Check it with curl -I http://mikecalo.co and confirm a 301 and a location of calo.company. Do this before touching Wix again.',
      'Only once the redirect answers: unpublish the Wix site, and let Premium lapse. Unpublishing first strands the domain and both results drop off Google for a while.',
      'Add a Person block to calo.company with sameAs pointing at your LinkedIn. LinkedIn currently outranks both sites, so it is the strongest signal you control.',
      'Expect a few weeks. Google has to recrawl mikecalo.co to see the redirect before the ranking moves across, which is another reason the domain has to stay alive.',
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
