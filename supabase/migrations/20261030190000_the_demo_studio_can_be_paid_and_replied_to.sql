/*
  Northwind Studio gets an email and two ways to be paid.

  The invoice document has a "How to pay" block and a "Questions" line, and the
  demo studio had neither an email in its settings nor a payment method with a
  handle on it, so both came out empty and neither could be checked. Venmo and
  PayPal, because those are the two the reference documents show as plain text
  a person can copy.

  Settings is merged, never replaced: that column also holds this workspace's
  colour, phone and address, and a bare object would delete them. See CLAUDE.md.

  Demo only, keyed on Northwind's id.
*/

update public.orgs
   set settings = coalesce(settings, '{}'::jsonb)
                || jsonb_build_object('email', 'studio@northwind.example'),
       payment_methods = '[
         {"id": "venmo",  "handle": "@northwind-studio",          "enabled": true},
         {"id": "paypal", "handle": "studio@northwind.example",   "enabled": true}
       ]'::jsonb
 where id = '912fe1dc-5b79-4f6f-b954-761fc4111f1d'
   and is_demo;
