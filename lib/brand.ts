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

/** Where to write when something is wrong. */
export const SUPPORT_EMAIL = 'mikexcalo@gmail.com';
