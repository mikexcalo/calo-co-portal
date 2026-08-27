# Email setup

Two separate systems send email, and they're configured in different places.
Both currently use a default sender that reads as spam.

---

## 1. Notifications — Resend

New-lead alerts and anything the app sends itself.

**Now:** `CALO&CO <onboarding@resend.dev>` — Resend's shared sandbox address.
It delivers, but it lands in spam more often than not, can't be replied to,
and looks untrustworthy to a client.

**To fix:**

1. In Resend → Domains, add a domain you control — `calo.company` is the
   natural one, since that's where clients click "Log in".
2. Add the DNS records Resend gives you (SPF, DKIM, and ideally DMARC).
   Verification usually takes minutes.
3. Set `MAIL_FROM` in Vercel to something on that domain, e.g.
   `CALO&CO <nautilus@calo.company>`.
4. Redeploy.

Use a subdomain like `mail.calo.company` if you'd rather keep app mail
separate from anything you send by hand — a deliverability problem on one
then can't drag down the other.

---

## 2. Login emails — Supabase

Invites and password resets. These do **not** go through Resend by default.

**Now:** Supabase's built-in email service. It is heavily rate-limited (a
handful per hour), sends from a Supabase address, and is explicitly not meant
for production.

**To fix** — point Supabase at Resend's SMTP:

Supabase Dashboard → Project Settings → Authentication → SMTP Settings:

```
Host      smtp.resend.com
Port      465
Username  resend
Password  <your Resend API key>
Sender    nautilus@calo.company   (must be on a verified domain)
Name      CALO&CO
```

Then Authentication → Emails to reword the invite and reset templates. The
defaults say "Supabase", which is confusing for a client who has never heard
of Supabase and thinks they're logging into your platform.

---

## Why this matters more than it sounds

Mark's first experience of Nautilus is an invite email. If it lands in spam,
or arrives from an address he doesn't recognize talking about a product he
doesn't know, the beta stalls before he ever sees a screen.
