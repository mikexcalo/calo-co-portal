/**
 * What this product is called.
 *
 * It was "Nautilus" in forty-three places, which meant renaming it was a
 * forty-three-place edit and a chance to miss one. Since the name is going to
 * change again — it is a placeholder until a real one turns up — the sensible
 * move is to spend the rename once, here, and make every future one a single
 * line.
 *
 * ONE PLACE THIS DOES NOT REACH: the label in someone's authenticator app.
 * That string is written into the QR code at the moment two-factor is set up,
 * so changing it here renames nothing for anyone already enrolled — they keep
 * seeing the old name until they set it up again. See AUTH_ISSUER below.
 */

/** The name shown to people using the product. */
export const PRODUCT = 'CALO&CO';

/**
 * The product's own name and mark, as shown at the top of the sidebar.
 *
 * Separate from PRODUCT, and that separation is the point. PRODUCT is
 * 'CALO&CO' because that is what the software is called today; the row above
 * the workspace plate is where the product's OWN name will go once it has
 * one, and it does not have one yet. Writing 'CALO&CO' there would say the
 * company name twice on one screen and quietly claim the question is settled.
 *
 * So it is a placeholder, and it is honest about being one. `[Product name]`
 * in brackets reads as a blank to be filled rather than as a name, and `logo`
 * being null draws a dashed outline rather than a mark nobody chose.
 *
 * Both come from here so naming the product is one edit. Set `name` to the
 * name and `logo` to a 16px square image, or leave `logo` null and keep the
 * outline. An empty `name` removes the row entirely.
 */
export const PRODUCT_MARK: { name: string; logo: string | null } = {
  name: '[Product name]',
  logo: null,
};

/**
 * Who provides it. Usually the same as PRODUCT today, but they come apart the
 * moment the product has a name of its own and CALO&CO is merely the company
 * behind it.
 */
export const PROVIDER = 'CALO&CO';

/**
 * The name that appears in authenticator apps.
 *
 * Deliberately pinned rather than following PRODUCT. Changing it only affects
 * people who enrol afterwards, so it should move on a considered decision —
 * not as a side effect of editing a heading. Changing it strands everyone
 * already set up with a label that no longer matches anything.
 */
export const AUTH_ISSUER = 'CALO&CO';

/**
 * Where to write when something is wrong.
 *
 * This was one person's personal Gmail, hardcoded, printed as a mailto on the
 * sign-in page and the public trust page — both of which a stranger reaches
 * before they have any relationship with anybody.
 *
 * Empty unless SUPPORT_EMAIL is set. A missing contact link is better than
 * one that hands out somebody's private address, and every place that uses
 * this now hides the link rather than rendering a broken one.
 */
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '').trim();
