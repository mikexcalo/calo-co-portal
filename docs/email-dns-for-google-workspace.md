# Adding Google Workspace to calo.company, without breaking Resend

Written ahead of the decision. **Nothing here has been applied.** It is the
exact record set to add when Mike picks his address, and the one trap that
would take the platform's mail down with it.

DNS for calo.company is at **Vercel** (`ns1.vercel-dns.com`), so these go in
the Vercel dashboard under the domain, not at a registrar.

## What is there today

| Record | Value | Who it belongs to |
|---|---|---|
| `calo.company` TXT | `v=spf1 include:amazonses.com ~all` | Resend |
| `resend._domainkey` TXT | DKIM public key | Resend |
| `send.calo.company` TXT | `v=spf1 include:amazonses.com ~all` | Resend bounce path |
| `send.calo.company` MX | `10 feedback-smtp.us-east-1.amazonses.com` | Resend bounce path |
| `_dmarc` TXT | `v=DMARC1; p=none; rua=mailto:mikexcalo@gmail.com` | Shared |
| `calo.company` MX | **none** | — |

**There is no inbound mail on calo.company today.** Nothing is received at the
domain, which is why adding Workspace is additive rather than a migration.

## What to add

### 1. MX, on the root

Google takes one record now; the old five-record set is still documented in
places and is not needed.

```
calo.company.   MX   1   smtp.google.com.
```

This cannot clash with Resend: Resend's MX is on `send.calo.company`, a
different hostname, and it must be left exactly as it is. That record is the
bounce path - delete it and the platform stops learning which invoices
bounced.

### 2. SPF - the one that breaks things

**There must be exactly one SPF record on the root.** Two is not "both work",
it is a permanent error, and every message the platform sends starts failing
authentication at once. So this is an edit, never an addition:

```
calo.company.   TXT   "v=spf1 include:_spf.google.com include:amazonses.com ~all"
```

Google first because it will carry the ordinary mail; `amazonses.com` is
Resend's and stays. Ten DNS lookups is the SPF limit and this uses two.

### 3. DKIM - no conflict

Selectors keep the two apart, so both live side by side:

- `resend._domainkey` - already there, leave it alone.
- `google._domainkey` - new. Generate it in the Workspace admin console
  (Apps → Google Workspace → Gmail → Authenticate email), at 2048-bit, and
  paste what it gives you. It does not exist until you generate it, so this
  record cannot be written ahead of time.

### 4. DMARC - tighten later, not now

`p=none` is already there and is right for the changeover: it reports without
rejecting. Leave it until Workspace has been sending for a fortnight and the
`rua` reports are clean, then move to `p=quarantine`.

## After the records are in

1. **Verify in both consoles.** Workspace will not deliver until it verifies;
   Resend's domain page should still read verified afterwards. If Resend goes
   amber, the SPF record was added rather than edited.
2. **Send one test each way** - one through the platform, one from the new
   Workspace address - and read the received headers for `spf=pass` and
   `dkim=pass`.
3. **Set `MAIL_FROM`.** It is already set in `.env.production.local`, and the
   fallback in code is `onboarding@resend.dev`, which is Resend's shared
   sandbox address. Once there is a real calo.company address, point it there:
   `MAIL_FROM="CALO&CO <mike@calo.company>"`. Until then the platform's mail
   carries an address that is not ours.

## The order that matters

Add MX and DKIM first, edit SPF last. SPF is the only record that is shared,
so it is the only one where a mistake takes down mail that works today.
