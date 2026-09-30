# globalseafood.partners

John owns the domain at Cloudflare. It stays there — Cloudflare Registrar
cannot use foreign nameservers — and points here with two A records to
76.76.21.21, both **DNS only** (grey cloud, not orange). Orange means
Cloudflare answers for the site itself and the certificate never issues.

Vercel project: `global-seafood-site`, separate from the Nautilus app. Deploys
are manual, from this directory. A push to this repo does not redeploy it.

    npx vercel deploy          # preview, behind Vercel SSO
    npx vercel deploy --prod   # the live site

## What this is

The site, built to `gsp-site/boards/` in the 29 Sept 2026 launch pack and to
section 4 of that pack's `GSP-BRAND-SPEC.md`. Two pages and one dialog:

    index.html    home
    about.html    John's story
    styles.css    one stylesheet, desktop above 900px and phone below
    app.js        the pop-up, the phone's side tabs, and the scroll reveal

The boards are two fixed mocks, 1440 and 390. This is the one responsive page
they describe, so the breakpoint is where the phone board's decisions take
over rather than where a device happens to sit.

## The form

Every "Get in touch" opens the same dialog. It POSTs to
`https://nautilusapp.vercel.app/api/leads/ingest` with `name`, `company`,
`email`, `phone`, `message`, the `website` honeypot, and
`source: 'globalseafood.partners'`.

**The source is load-bearing.** Nautilus maps it to the business whose book a
lead lands in, and it notifies `globalseafood.partners@gmail.com` and
`john.littonny@gmail.com`. Changing that string sends John's enquiries into
somebody else's CRM. If the POST fails the dialog hands over
`john.littonny@gmail.com` rather than dead-ending.

## Rolling back

Four builds worth keeping:

    dpl_CbFtDam3fm1vEn1FJdPCnTPb44os   the holding page, up until 29 Sept 2026
    dpl_FkTCPTNvTftHtmc5C3T6ymRCydZN   the first build of this site, before the
                                       hover and quotes pass
    dpl_CyiJUoTu1kEqoVssDSMvnEYCymbL   before the nav underline, the revised
                                       button hovers, and the hero at 1.0
    dpl_9oVTxfoiyDgi5KzV7VqHMgodpbG6   before the two-file hero, the smoothed
                                       logos, the pinned header, and the
                                       footer credit

Promote any of them to go back:

    npx vercel promote <its url>
