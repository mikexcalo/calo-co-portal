# Integrations — planned

## Voice AI answering Mark's calls

**Goal:** a voice agent picks up when Mammoth can't, qualifies the caller, and
the lead lands in Nautilus the same as a web form lead.

**The integration point already exists.** `/api/leads/ingest` is public,
CORS-open, and takes JSON:

```json
{
  "source": "mammoth-voice-agent",
  "name":   "Grigoriy Gorshteyn",
  "email":  "g@example.com",
  "phone":  "555-0100",
  "message": "Full bathroom remodel, wants to start in March",
  "address": "12 Elm St, Portland ME"
}
```

It creates a customer plus a job at status `lead`, routed to the right
business by `source` (anything matching `/mammoth/i` goes to Mammoth). Most
voice platforms — Bland, Vapi, Retell, Synthflow — can POST a webhook at
end-of-call, so this is largely a configuration job rather than a build.

**What would need doing when we get there:**

1. **Email is currently required.** Callers often won't give one. Either relax
   the validation to accept phone-only leads, or synthesize a placeholder —
   relaxing it is cleaner, since a phone number is the better identifier for a
   phone lead anyway.
2. **Add a routing entry** for the voice source, so a mis-set `source` can't
   drop calls into the wrong book.
3. **Store the transcript.** The call recording or transcript belongs on the
   job — "what did they actually say" is the whole value, and it's exactly
   what the documents pipeline already does for paper.
4. **Deduplicate against the web form.** Someone who calls and then fills in
   the form is one lead. Matching on phone as well as email would handle it.
5. **Rate limiting and a shared secret.** The endpoint is public. It's fine
   for a form behind a honeypot; a known caller posting structured leads
   should authenticate, or someone will find it and fill the CRM with junk.

**Worth deciding early:** whether the agent books time on a calendar or only
captures. Capture-only is far simpler and probably right to start.
