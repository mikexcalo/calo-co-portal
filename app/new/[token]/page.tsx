import { createClient } from '@supabase/supabase-js';
import { Form } from './Form';

/**
 * The enquiry form, for somebody who has never heard of this software.
 *
 * Four fields, and only one of them required. Every extra field on a form like
 * this loses people, and a name and a phone number is enough to call somebody
 * back, which is the entire job.
 */

export const dynamic = 'force-dynamic';

/*
  The tab said "CALO&CO".

  This page sets no metadata, so it inherited the root layout's, which names
  the product. A stranger filling in Harbor Light Roofing's enquiry form saw
  another company's name in the browser tab, and anybody sharing the link got
  "CALO&CO, run the work, bill the work." as the preview text.

  The business whose form it is, and nothing else.
*/
export async function generateMetadata(
  { params }: { params: { token: string } }
): Promise<{ title: string; description: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { title: 'Get in touch', description: '' };
  try {
    const db = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await db.rpc('business_name_for_intake', { t: params.token });
    const name = (data as string | null) ?? null;
    return name
      ? { title: `Get in touch · ${name}`, description: `Send ${name} a message.` }
      : { title: 'Get in touch', description: '' };
  } catch {
    return { title: 'Get in touch', description: '' };
  }
}

export default async function EnquiryPage({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let name: string | null = null;

  if (url && anon) {
    const db = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await db.rpc('business_name_for_intake', { t: params.token });
    name = (data as string | null) ?? null;
  }

  if (!name) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#fff' }}>
        <p style={{ fontSize: 15, color: '#69727D', fontFamily: '-apple-system, sans-serif' }}>
          This form isn&apos;t available.
        </p>
      </main>
    );
  }

  return <Form token={params.token} business={name} />;
}
