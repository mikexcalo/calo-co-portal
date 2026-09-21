# globalseafood.partners

John owns the domain at Cloudflare. It stays there — Cloudflare Registrar
cannot use foreign nameservers — and points here with two A records to
76.76.21.21, both **DNS only** (grey cloud, not orange). Orange means
Cloudflare answers for the site itself and the certificate never issues.

Vercel project: `global-seafood-site`, separate from the Nautilus app.

Deploy from this directory:

    npx vercel deploy --prod

This is a holding page, not the site. It exists so the address resolves and
the certificate is issued. Everything on it is placeholder copy written from
"seafood distributor" and nothing more — John has not approved a word of it.
