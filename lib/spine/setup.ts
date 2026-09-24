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
  {
    key: 'old_wix_site',
    forRoles: ['owner', 'admin'],
    title: 'mikecalo.co expires on 28 September and redirects nowhere',
    icon: 'globe',
    urgent: true,
    blocks:
      'Everything anybody has ever linked to mikecalo.co stops working on Monday, and every result Google holds for it disappears rather than moving to calo.company.\n\n'
      + 'The thing that decides whether this works is not the redirect. It is whether the domain is still paid for afterwards. A 301 only passes anything while somebody can still follow it: Google has to re-crawl the old address, see the redirect, and move each signal across one at a time, which takes weeks and often months. Google\u2019s own guidance is to keep a move redirect up for at least a year and to keep paying for the old domain for at least that long.\n\n'
      + 'Let it lapse on Monday and the redirect will have been live for four days. Almost nothing will have transferred, and the name becomes available to whoever wants it.\n\n'
      + 'Two things are worth knowing before you start. The registration is at Network Solutions, not Wix \u2014 Wix only runs the DNS, so renewing inside Wix is not a thing you can do. And calo.company is on Vercel, so the Wix option called \u201credirect to your primary domain\u201d does not apply either; it assumes both ends are Wix sites.',
    steps: [
      'Renew it, and nothing else on this list matters if you skip it. [Network Solutions](https://www.networksolutions.com/manage-it/index.jsp) holds the registration \u2014 not Wix, which only runs the DNS. A .co is roughly $20 to $40 for the year. Buy a year; you can drop it next September once the redirect has done its work.',
      'Write down where you have linked it, before anything changes. Your LinkedIn profile, your email signature, anything printed, and any client site that credits you. Then search Google for ["mikecalo.co" -site:mikecalo.co](https://www.google.com/search?q=%22mikecalo.co%22+-site%3Amikecalo.co) to find the ones somebody else controls. A redirect covers all of these, which is the point of keeping it up \u2014 but the ones you own are worth changing at the source.',
      'Add the domain to Vercel as a redirect. [calo-co-site, Domains](https://vercel.com/mikexcalo-7384s-projects/calo-co-site/settings/domains), Add Domain, type mikecalo.co, and choose Redirect to calo.company with status 308. Repeat for www.mikecalo.co \u2014 the live site serves on www, so missing it would break the half of the links that use it.',
      'Vercel will show you the nameservers it wants. Take them to Network Solutions, open the domain, and change the nameservers from ns10.wixdns.net and ns11.wixdns.net to the two Vercel gives you. This is the moment the domain leaves Wix.',
      'Wait for it to take. Nameserver changes are usually minutes and occasionally a few hours. Vercel will say Valid Configuration when it is done, and it issues the certificate itself.',
      'Check it by hand rather than trusting the dashboard: open a terminal and run curl -I https://mikecalo.co and curl -I https://www.mikecalo.co. You want 301 or 308 and a Location of https://calo.company. A 200 means you are still hitting Wix.',
      'Unpublish the Wix site once the redirect answers. In [Wix domains](https://manage.wix.com/account/domains), or Site then Unpublish in the editor. Leaving a second live copy of an outdated site with your name on it is the thing you were trying to avoid.',
      'Tell Google it moved. In [Search Console](https://search.google.com/search-console) add mikecalo.co as a Domain property, verify it, then use Settings and Change of Address to point it at calo.company. This is the one step that asks Google to move the signals deliberately rather than waiting to be noticed. It needs both properties verified, which is why the calo.company task above comes first.',
      'Put a reminder in for next September to decide whether to renew again. By then the redirect will have done what it can, and you will be able to see in Search Console whether anything still arrives through the old name.',
    ],
  },
  {
    key: 'search_console',
    forRoles: ['owner', 'admin'],
    title: 'You cannot see what people search to find you',
    icon: 'search',
    blocks:
      'You are guessing about search instead of reading it.\n\nSearch Console is the only place that tells you which queries showed your site, where you ranked on each, and what people actually clicked. Nothing else can tell you that, including the traffic numbers in here, because a visitor arrives without bringing their search along.\n\nThe reason it is not last on the list: it keeps no history from before the day you verify. Every day it is off is a day of data you cannot go back and get.',
    steps: [
      'Open [Search Console](https://search.google.com/search-console), add a property, and choose Domain rather than URL prefix so subdomains are covered.',
      'Add the TXT record it gives you at your registrar. Verification usually lands within the hour.',
      'Submit the sitemap once it verifies.',
      'Do this before the Wix redirect, not after. Having both the before and after is how you can tell whether the redirect worked.',
    ],
  },
  {
    key: 'invite_team',
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
    forRoles: ['owner', 'admin', 'finance'],
    title: 'Clients cannot pay an invoice by card',
    icon: 'card',
    blocks:
      'Invoices can be raised and sent, and then not paid by card.\n\nEverything else about billing already works: line items, totals, what has been collected, what is owed, and the reminder when something goes past due. The gap is only the Pay button, so today a client either sends a transfer or you chase them by hand.\n\nYou deferred this and that is still reasonable. Card payments cost roughly three percent, and at your volume a Venmo or a transfer costs nothing. This becomes worth it when a client asks to pay by card rather than when you feel behind for not having it.',
    steps: [
      'Open [Stripe API keys](https://dashboard.stripe.com/apikeys).',
      'Copy the secret key and the publishable key.',
      'Add them in [Vercel environment variables](https://vercel.com/mikexcalo-7384s-projects/calo-co-portal/settings/environment-variables) as STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, then redeploy.',
      'One account pays one business. If a client needs card payments into their own account, that is Stripe Connect and a separate piece of work.',
    ],
  },
  {
    key: 'google_profile',
    forRoles: ['owner', 'admin'],
    title: 'You do not appear in Google Maps',
    icon: 'target',
    blocks:
      'You do not exist in map results, and until somebody claims the profile anybody can edit it.\n\nThat second part is the one people miss. An unclaimed profile is not an absent profile, it is an unowned one, and Google accepts edits to the hours, the category and the address from strangers.\n\nIt also gates the review link below, which gates asking finished jobs for a review. Start the verification early because it moves at the speed of a postcard, about a week, and everything else can be done while it is in the mail.',
    steps: [
      'Decide first whether to publish an address. If customers do not come to you, choose that you deliver to them and Google hides it.',
      'Open [Google Business Profile](https://business.google.com/), then claim or create.',
      'Verification is a postcard, about a week. Start it and do the rest while it is in the mail.',
      'The full checklist and the generated address block are in Digital, under Search.',
    ],
  },
  {
    key: 'review_link',
    forRoles: ['owner', 'admin'],
    title: 'Finished jobs are never asked for a review',
    icon: 'star',
    blocks:
      'Finished work never gets asked for a review, and asking is the whole trick.\n\nThe difference between a business with forty reviews and one with four is almost never the quality of the work. It is that one of them asks every time and the other asks when it remembers. Once this link is set, every job that is finished and paid up sends one request by itself and you never think about it again.\n\nNeeds the Google profile above claimed first, because the link comes from inside it.',
    steps: [
      'Needs the Google profile claimed first.',
      'In the profile, Ask for reviews, and copy the link.',
      'Paste it into Business, What you charge.',
      'From then on every finished, paid-up job gets one request automatically.',
    ],
  },
  {
    key: 'default_branch',
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
