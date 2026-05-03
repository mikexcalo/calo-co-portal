/**
 * Database functions for CALO&CO Portal
 * All Supabase operations and in-memory cache management
 */

import supabase from './supabase';
import {
  Client,
  Invoice,
  Contact,
  Expense,
  ActivityLogEntry,
  BrandKit,
  Agency,
  AgencySettings,
  Note,
  Task,
  Event,
  CrmContact,
  DBCache,
} from './types';
import { displayToIso, isoToDisplay } from './utils';

/**
 * Runtime in-memory cache - singleton instance
 */
export const DB: DBCache = {
  agency: {
    name: 'CALO&CO',
    founder: 'Mike Calo',
    url: 'mikecalo.co',
    location: 'Portland, Maine',
    brandKit: {
      _id: null,
      logos: {
        light: [],
        dark: [],
        color: [],
        icon: [],
        secondary: [],
        favicon: [],
      },
      colors: [],
      fonts: { heading: '', body: '', accent: '' },
      notes: '',
    },
    emailSignatureHtml: '',
    signatureFields: {},
  },
  clients: [],
  clientsState: 'loading',
  invoices: [],
  _nextInvNum: {},
  activityLog: [],
  contacts: {},
  expenses: [],
  agencySettings: {
    taxRate: 28,
    fiscalYearStart: 1,
    paymentMethods: [
      { method: 'Zelle', handle: 'mikexcalo@gmail.com' },
      { method: 'Venmo', handle: '@mikecalo' },
      { method: 'PayPal', handle: 'mikexcalo@gmail.com' },
    ],
  },
};

/**
 * Initialize Supabase and verify connectivity
 */
export async function initSupabase(): Promise<boolean> {
  if (!supabase) {
    console.warn(
      'Supabase not configured — running without persistence'
    );
    return false;
  }
  try {
    // Test connectivity
    const { error } = await supabase.from('clients').select('count').limit(1);
    if (error) {
      console.error('[initSupabase] connectivity error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[initSupabase] exception:', e);
    return false;
  }
}

/**
 * Initialize or load agency record
 */
export async function initAgency(): Promise<void> {
  try {
    const { data } = await supabase.from('agency').select('*').limit(1);

    if (!data || data.length === 0) {
      const { error } = await supabase.from('agency').insert({
        name: 'CALO&CO',
        founder: 'Mike Calo',
        url: 'mikecalo.co',
        location: 'Portland, Maine',
      });
      if (error) {
        console.error('[initAgency] insert error:', JSON.stringify(error));
      }
    } else {
      const ag = data[0];
      DB.agency.name = ag.name || DB.agency.name;
      DB.agency.founder = ag.founder || DB.agency.founder;
      DB.agency.url = ag.url || DB.agency.url;
      DB.agency.location = ag.location || DB.agency.location;
    }
  } catch (e) {
    console.error('[initAgency] exception:', e);
  }
}

/**
 * Load all clients from Supabase
 */
export async function loadClients(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[loadClients] error:', JSON.stringify(error));
      DB.clientsState = 'error';
      return;
    }

    if (!data) {
      console.warn('[loadClients] no data returned');
      DB.clientsState = 'error';
      return;
    }

    DB.clients = data.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      address_line_1: c.address_line_1 || '',
      address_line_2: c.address_line_2 || '',
      city: c.city || '',
      state: c.state || '',
      postal_code: c.postal_code || '',
      website: c.website || '',
      code: c.code || '',
      logo: null,
      activeModules: c.active_modules || ['invoices'],
      hasBrandKit: (c.active_modules || []).includes('brand_kit'),
      hasEmailSig: true,
      engagementStatus: c.engagement_status || 'active',
      lifecycleStage: c.lifecycle_stage || 'active',
      nextStep: c.next_step || '',
      emailSignatureHtml: c.email_signature_html || '',
      signatureFields: c.signature_fields || {},
      brandKit: {
        _id: null,
        logos: {
          light: [],
          dark: [],
          color: [],
          icon: [],
          secondary: [],
          favicon: [],
        },
        colors: [],
        fonts: { heading: '', body: '', accent: '' },
        notes: '',
      },
    }));

    DB.clientsState = 'loaded';
  } catch (e) {
    console.error('[loadClients] exception:', e);
    DB.clientsState = 'error';
  }
}

/**
 * Save or update a client record
 */
export async function saveClient(client: Client): Promise<any> {
  try {
    const bizName = client.company || client.name || '';
    const row: any = {
      name: bizName,
      company: bizName,
      email: client.email || null,
      phone: client.phone || null,
      address_line_1: client.address_line_1 || null,
      address_line_2: client.address_line_2 || null,
      city: client.city || null,
      state: client.state || null,
      postal_code: client.postal_code || null,
      website: client.website || null,
      code: (client as any).code || null,
    };

    // Persist signature data if present
    if (client.signatureFields && Object.keys(client.signatureFields).length > 0) {
      row.signature_fields = client.signatureFields;
    }
    if (client.emailSignatureHtml) {
      row.email_signature_html = client.emailSignatureHtml;
    }

    if (client.id) row.id = client.id;

    const { data, error } = await supabase
      .from('clients')
      .upsert(row)
      .select();

    if (error) {
      console.error('[saveClient] error:', JSON.stringify(error));
      return null;
    }

    if (!error && data && data[0] && !client.id) {
      client.id = data[0].id;
    }

    return data && data[0] ? data[0] : null;
  } catch (e) {
    console.error('[saveClient] exception:', e);
    return null;
  }
}

/**
 * Update client's next step
 */
export async function saveNextStep(
  clientId: string,
  val: string
): Promise<void> {
  const cl = DB.clients.find((c) => c.id === clientId);
  if (!cl) return;

  cl.nextStep = val;

  try {
    const { error } = await supabase
      .from('clients')
      .update({ next_step: val || null })
      .eq('id', clientId);

    if (error) {
      console.error('[saveNextStep] error:', JSON.stringify(error));
    }
  } catch (e) {
    console.error('[saveNextStep] exception:', e);
  }
}

/**
 * Update client's engagement status
 */
export async function saveEngagementStatus(
  clientId: string,
  val: string
): Promise<void> {
  const cl = DB.clients.find((c) => c.id === clientId);
  if (!cl) return;

  cl.engagementStatus = val as 'active' | 'paused' | 'closed';

  try {
    const { error } = await supabase
      .from('clients')
      .update({ engagement_status: val })
      .eq('id', clientId);

    if (error) {
      console.error('[saveEngagementStatus] error:', JSON.stringify(error));
    }
  } catch (e) {
    console.error('[saveEngagementStatus] exception:', e);
  }
}

/**
 * Load invoices for a specific client
 */
export async function loadInvoices(clientId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', clientId);

    if (error) {
      console.error('[loadInvoices] error:', JSON.stringify(error));
      return;
    }

    if (!data) return;

    // Remove existing invoices for this client
    DB.invoices = DB.invoices.filter((i) => i.clientId !== clientId);

    // Add new invoices — handle both old and new column structures
    data.forEach((row) => {
      // line_items can be: array of items (new) or object with .items (old)
      let itemsArr: any[] = [];
      if (Array.isArray(row.line_items)) {
        itemsArr = row.line_items;
      } else if (row.line_items && typeof row.line_items === 'object') {
        itemsArr = row.line_items.items || [];
      }

      DB.invoices.push({
        id: row.invoice_number || row.id,
        _uuid: row.id,
        clientId: row.client_id,
        project: row.project_name || '',
        date: isoToDisplay(row.issued_date),
        due: isoToDisplay(row.due_date),
        status: row.status || 'draft',
        tax: row.tax || 0,
        shipping: row.shipping || 0,
        type: row.type || 'service',
        notes: row.notes || '',
        attachmentUrl: row.attachment_url || null,
        netCost: row.internal_margin || 0,
        items: itemsArr,
        projectDesc: row.project_description || '',
        isReimbursement: row.type === 'reimbursement',
        paidDate: row.paid_at || null,
        internalNotes: '',
        vendorOrder: '—',
        vendorDate: '—',
      });
    });
  } catch (e) {
    console.error('[loadInvoices] exception:', e);
  }
}

/**
 * Save or update an invoice
 */
export async function saveInvoice(inv: Invoice): Promise<any> {
  try {
    const lineItems = inv.items || [];
    const subtotal = lineItems.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0);
    const total = subtotal + (inv.tax || 0) + (inv.shipping || 0);

    // Match EXACT Supabase columns: id, client_id, invoice_number, status,
    // issued_date, project_name, project_description, due_date, terms,
    // line_items, subtotal, tax, shipping, total, notes, paid_at
    const row: any = {
      client_id: inv.clientId,
      invoice_number: inv.id,
      status: inv.status,
      issued_date: displayToIso(inv.date),
      due_date: displayToIso(inv.due),
      project_name: inv.project || null,
      project_description: inv.projectDesc || null,
      terms: (inv as any).terms || null,
      line_items: lineItems,
      subtotal,
      tax: inv.tax || 0,
      shipping: inv.shipping || 0,
      total,
      type: (inv as any).type || 'service',
      source_quote_id: (inv as any).sourceQuoteId || null,
      notes: inv.notes || null,
      paid_at: inv.paidDate ? new Date(inv.paidDate).toISOString() : null,
    };

    if (inv._uuid) row.id = inv._uuid;

    console.log('INVOICE PAYLOAD:', JSON.stringify(row));
    console.log('COLUMNS:', Object.keys(row));

    const { data, error } = await supabase
      .from('invoices')
      .upsert(row)
      .select();

    console.log('INSERT RESULT:', JSON.stringify(data), 'ERROR:', JSON.stringify(error));

    if (error) {
      console.error('[saveInvoice] error:', JSON.stringify(error));
      return null;
    }

    if (data && data[0] && !inv._uuid) {
      inv._uuid = data[0].id;
    }

    return data && data[0] ? data[0] : null;
  } catch (e) {
    console.error('[saveInvoice] exception:', e);
    return null;
  }
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(invId: string): Promise<void> {
  try {
    const inv = DB.invoices.find((i) => i.id === invId);
    if (!inv || !inv._uuid) return;

    const { error } = await supabase.from('invoices').delete().eq('id', inv._uuid);

    if (error) {
      console.error('[deleteInvoice] error:', JSON.stringify(error));
      return;
    }

    DB.invoices = DB.invoices.filter((i) => i.id !== invId);
  } catch (e) {
    console.error('[deleteInvoice] exception:', e);
  }
}

/**
 * Upload invoice attachment file
 */
export async function uploadInvoiceAttachment(file: File): Promise<string | null> {
  try {
    const path = `attachments/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from('invoice-attachments')
      .upload(path, file, { upsert: true });

    if (error) {
      console.error('[uploadInvoiceAttachment] error:', JSON.stringify(error));
      return null;
    }

    const { data } = supabase.storage
      .from('invoice-attachments')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (e) {
    console.error('[uploadInvoiceAttachment] exception:', e);
    return null;
  }
}

/**
 * Load all brand kits (clients + agency)
 */
export async function loadAllBrandKits(): Promise<void> {
  try {
    const [{ data: kits }, { data: assets }] = await Promise.all([
      supabase.from('brand_kits').select('*'),
      supabase.from('assets').select('*'),
    ]);

    if (!kits) return;

    // Index assets by brand kit ID
    const assetsByKit: Record<string, any[]> = {};
    (assets || []).forEach((a) => {
      if (!assetsByKit[a.brand_kit_id]) assetsByKit[a.brand_kit_id] = [];
      assetsByKit[a.brand_kit_id].push(a);
    });

    // Process each brand kit
    kits.forEach((kit) => {
      const kitAssets = assetsByKit[kit.id] || [];
      const logos = {
        light: [],
        dark: [],
        color: [],
        icon: [],
        secondary: [],
        favicon: [],
      } as any;

      kitAssets.forEach((a) => {
        if (logos[a.slot]) {
          logos[a.slot].push({
            name: a.file_name || a.slot,
            type: 'image/unknown',
            data: a.storage_url,
            isPrimary: a.is_primary || false,
            _assetId: a.id,
          });
        }
      });

      // Ensure at least one logo per slot is marked primary
      Object.keys(logos).forEach((slot) => {
        const arr = logos[slot];
        if (arr.length > 0 && !arr.some((f: any) => f.isPrimary)) {
          arr[0].isPrimary = true;
        }
      });

      const bk: BrandKit = {
        _id: kit.id,
        logos,
        colors: kit.color_palette || [],
        fonts: kit.typography || { heading: '', body: '', accent: '' },
        notes: kit.brand_notes || '',
      };

      if (kit.client_id === null) {
        DB.agency.brandKit = bk;
      } else {
        const cl = DB.clients.find((c) => c.id === kit.client_id);
        if (cl) {
          cl.brandKit = bk;
          const priSrc = cl.brandKit.logos.color.find((f) => f.isPrimary);
          if (priSrc) cl.logo = priSrc.data;
        }
      }
    });
  } catch (e) {
    console.error('[loadAllBrandKits] exception:', e);
  }
}

/**
 * Save or update a brand kit
 */
export async function saveBrandKit(bk: BrandKit, clientId?: string | null): Promise<any> {
  // Guard: if a save is already in flight for this kit, skip (prevents race condition)
  if (bk._saving) return;

  bk._saving = true;

  try {
    const row: any = {
      client_id: clientId || null,
      typography: bk.fonts || {},
      color_palette: bk.colors || [],
      brand_notes: bk.notes || '',
    };

    if (bk._id) row.id = bk._id;

    let data: any[] | null = null;
    let error: any = null;

    if (bk._id) {
      // Update existing
      const res = await supabase.from('brand_kits').update(row).eq('id', bk._id).select();
      data = res.data; error = res.error;
    } else {
      // Check if one exists for this client
      const { data: existing } = await supabase.from('brand_kits').select('id').eq('client_id', clientId || '').maybeSingle();
      if (existing) {
        bk._id = existing.id;
        row.id = existing.id;
        const res = await supabase.from('brand_kits').update(row).eq('id', existing.id).select();
        data = res.data; error = res.error;
      } else {
        const res = await supabase.from('brand_kits').insert(row).select();
        data = res.data; error = res.error;
      }
    }

    if (error) {
      console.error('[saveBrandKit] error:', JSON.stringify(error));
      return null;
    }

    if (data && data[0] && !bk._id) {
      bk._id = data[0].id;
    }

    return data && data[0] ? data[0] : null;
  } catch (e) {
    console.error('[saveBrandKit] exception:', e);
    return null;
  } finally {
    bk._saving = false;
  }
}

/**
 * Upload a brand asset (logo, etc.)
 */
export async function uploadAsset(
  brandKitId: string,
  slot: string,
  file: File
): Promise<{ url: string; assetId: string } | null> {
  try {
    if (!brandKitId) {
      console.error('[uploadAsset] brandKitId is null — brand kit row not created yet');
      return null;
    }

    // is_primary = true for renderable files (PNG/SVG/JPG); false for source files (AI/EPS/PDF)
    const ext = (file.name.match(/\.([^.]+)$/) || [])[1] || '';
    const isRenderable = /^(png|jpg|jpeg|svg|webp|gif)$/i.test(ext);

    // Path: brandKitId/slot/filename — upsert:true overwrites same-named file
    const path = `${brandKitId}/${slot}/${file.name}`;

    const { error: upErr } = await supabase.storage
      .from('brand-assets')
      .upload(path, file, { upsert: true });

    if (upErr) {
      console.error('[uploadAsset] storage error:', JSON.stringify(upErr));
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(path);

    const { data: assetData, error: assetErr } = await supabase
      .from('assets')
      .insert({
        brand_kit_id: brandKitId,
        slot,
        file_name: file.name,
        storage_url: urlData.publicUrl,
        is_primary: isRenderable,
      })
      .select();

    if (assetErr) {
      console.error('[uploadAsset] insert error:', JSON.stringify(assetErr));
      return null;
    }

    if (!assetData || !assetData[0]) {
      console.error('[uploadAsset] assets insert returned no data');
      return null;
    }

    return { url: urlData.publicUrl, assetId: assetData[0].id };
  } catch (e) {
    console.error('[uploadAsset] exception:', e);
    return null;
  }
}

/**
 * Delete an asset
 */
export async function deleteAsset(assetId: string): Promise<void> {
  try {
    const { error } = await supabase.from('assets').delete().eq('id', assetId);

    if (error) {
      console.error('[deleteAsset] error:', JSON.stringify(error));
    }
  } catch (e) {
    console.error('[deleteAsset] exception:', e);
  }
}

/**
 * Update which asset is marked as primary for a slot
 */
export async function updateAssetPrimary(
  brandKitId: string,
  slot: string,
  primaryAssetId: string | null
): Promise<void> {
  try {
    // Clear all primary flags for this slot
    const { error: err1 } = await supabase
      .from('assets')
      .update({ is_primary: false })
      .eq('brand_kit_id', brandKitId)
      .eq('slot', slot);

    if (err1) {
      console.error('[updateAssetPrimary] clear primary', err1);
    }

    // Set new primary if provided
    if (primaryAssetId) {
      const { error: err2 } = await supabase
        .from('assets')
        .update({ is_primary: true })
        .eq('id', primaryAssetId);

      if (err2) {
        console.error('[updateAssetPrimary] set primary', err2);
      }
    }
  } catch (e) {
    console.error('[updateAssetPrimary] exception:', e);
  }
}

/**
 * Load activity log entries
 */
export async function loadActivityLog(): Promise<void> {
  try {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data) return;

    DB.activityLog = data.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      eventType: r.event_type,
      metadata: r.metadata || {},
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('[loadActivityLog] exception:', e);
  }
}

/**
 * Log an activity event
 */
export async function logActivity(
  clientId: string,
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    if (!clientId) return;

    const { error } = await supabase.from('activity_log').insert({
      client_id: clientId,
      event_type: eventType,
      metadata,
    });

    if (error) {
      console.warn('[logActivity] failed', error);
    }
  } catch (e) {
    console.warn('[logActivity] exception:', e);
  }
}

/**
 * Save a task or note (from command bar AI)
 */
export async function saveTaskNote(
  clientId: string,
  type: 'task' | 'note',
  content: string
): Promise<any> {
  try {
    console.log('[saveTaskNote] Inserting:', { clientId, type, content: content.substring(0, 50) });

    const { data, error } = await supabase
      .from('client_tasks_notes')
      .insert({ client_id: clientId, type, content, status: 'open' })
      .select();

    if (error) {
      console.warn('[saveTaskNote] client_tasks_notes error:', error.code, error.message);
      // Fallback to client_notes table
      const { data: d2, error: e2 } = await supabase
        .from('client_notes')
        .insert({ client_id: clientId, content })
        .select();
      console.log('[saveTaskNote] Fallback client_notes:', d2 ? 'success' : 'failed', e2?.message || '');
      return d2?.[0] || null;
    }
    console.log('[saveTaskNote] Inserted into client_tasks_notes:', data?.[0]?.id);
    return data?.[0] || null;
  } catch (e) {
    console.warn('[saveTaskNote] exception:', e);
    return null;
  }
}

/**
 * Load tasks and notes for a client (or all if no clientId)
 */
export async function loadTasksNotes(clientId?: string): Promise<any[]> {
  try {
    // Try the primary table first
    let query = supabase
      .from('client_tasks_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;

    if (!error && data) {
      // Primary table exists and returned (even if 0 rows)
      console.log('[loadTasksNotes] Loaded from client_tasks_notes:', data.length, clientId ? `(client: ${clientId})` : '(all)');
      return data;
    }

    // Primary table doesn't exist or errored — fall back
    console.warn('[loadTasksNotes] client_tasks_notes error:', error?.code, error?.message, '— trying client_notes fallback');

    // Fallback: try client_notes table
    let fallbackQuery = supabase
      .from('client_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (clientId) fallbackQuery = fallbackQuery.eq('client_id', clientId);

    const { data: fallbackData, error: fallbackErr } = await fallbackQuery;

    if (fallbackErr) {
      console.warn('[loadTasksNotes] client_notes fallback error:', fallbackErr.code, fallbackErr.message);
      return data || [];
    }

    // Normalize client_notes rows to match the expected shape
    const normalized = (fallbackData || []).map((row: any) => ({
      id: row.id,
      client_id: row.client_id,
      type: 'note' as const,
      content: row.content,
      status: 'open',
      created_at: row.created_at,
      completed_at: null,
    }));

    console.log('[loadTasksNotes] Loaded from client_notes fallback:', normalized.length);
    return [...(data || []), ...normalized];
  } catch (e) {
    console.warn('[loadTasksNotes] exception:', e);
    return [];
  }
}

/**
 * Update task status (complete/reopen)
 */
export async function updateTaskStatus(
  id: string,
  status: 'open' | 'complete'
): Promise<void> {
  try {
    const row: any = { status };
    if (status === 'complete') row.completed_at = new Date().toISOString();
    else row.completed_at = null;

    const { error } = await supabase
      .from('client_tasks_notes')
      .update(row)
      .eq('id', id);

    if (error) console.warn('[updateTaskStatus] error:', error.message);
  } catch (e) {
    console.warn('[updateTaskStatus] exception:', e);
  }
}

/**
 * Delete a task/note by ID
 */
export async function deleteTaskNote(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('client_tasks_notes').delete().eq('id', id);
    if (error) {
      // Fallback to client_notes
      await supabase.from('client_notes').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[deleteTaskNote] exception:', e);
  }
}

/** Backward compat alias */
export const saveClientNote = (clientId: string, content: string) =>
  saveTaskNote(clientId, 'note', content);

/**
 * Load contacts for a specific client
 */
export async function loadContacts(clientId: string): Promise<void> {
  try {
    if (!clientId) return;

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false });

    if (!data) return;

    // Supabase column is `role` — map role→title for UI compatibility
    DB.contacts[clientId] = data.map((c) => ({
      id: c.id,
      clientId: c.client_id,
      name: c.name,
      title: c.role || '',
      role: c.role || '',
      email: c.email || '',
      phone: c.phone || '',
      isPrimary: c.is_primary || false,
    }));
  } catch (e) {
    console.error('[loadContacts] exception:', e);
  }
}

/**
 * Save or update a contact
 */
export async function saveContact(contact: Contact): Promise<Contact | null> {
  try {
    if (!contact.clientId) {
      console.error('[saveContact] missing clientId — refusing to save');
      return null;
    }

    if (contact.id) {
      // UPDATE — don't rely on .select(); RLS may block SELECT even when UPDATE succeeds
      // Supabase column is `role` — do NOT send `title` (no such column)
      const { error } = await supabase
        .from('contacts')
        .update({
          name: contact.name,
          role: contact.role || null,
          email: contact.email || null,
          phone: contact.phone || null,
          is_primary: contact.isPrimary || false,
        })
        .eq('id', contact.id);

      if (error) throw error;

      // Construct confirmation object from payload — use `role` consistently
      return {
        id: contact.id,
        clientId: contact.clientId,
        name: contact.name,
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        isPrimary: contact.isPrimary || false,
      };
    } else {
      // INSERT — need the server-assigned id back
      // Supabase column is `role` — do NOT send `title` (no such column)
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          client_id: contact.clientId,
          name: contact.name,
          role: contact.role || null,
          email: contact.email || null,
          phone: contact.phone || null,
          is_primary: contact.isPrimary || false,
        })
        .select();

      if (error) throw error;

      // If RLS blocks the select, fall back to a synthesised row so callers don't treat it as failure
      if (data && data[0]) {
        return {
          id: data[0].id,
          clientId: contact.clientId,
          name: data[0].name,
          role: data[0].role || '',
          email: data[0].email || '',
          phone: data[0].phone || '',
          isPrimary: data[0].is_primary || false,
        };
      } else {
        return {
          clientId: contact.clientId,
          name: contact.name,
          role: contact.role || '',
          email: contact.email || '',
          phone: contact.phone || '',
          isPrimary: contact.isPrimary || false,
        };
      }
    }
  } catch (e) {
    console.error('[saveContact] error:', JSON.stringify(e));
    return null;
  }
}

/**
 * Delete a contact
 */
export async function deleteContact(contactId: string): Promise<void> {
  try {
    if (!contactId) return;

    const { error } = await supabase.from('contacts').delete().eq('id', contactId);

    if (error) {
      console.error('[deleteContact] error:', JSON.stringify(error));
    }
  } catch (e) {
    console.error('[deleteContact] exception:', e);
  }
}

/**
 * Load all expenses
 */
export async function loadExpenses(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.warn('[loadExpenses] table may not exist:', error.code || error.message);
      DB.expenses = [];
      return;
    }

    if (!data || !Array.isArray(data)) {
      DB.expenses = [];
      return;
    }

    DB.expenses = data.map((r) => ({
      id: r.id,
      date: r.date,
      category: r.category || 'other',
      vendor: r.vendor || '',
      description: r.description || '',
      amount: parseFloat(r.amount) || 0,
      invoiceId: r.invoice_id || null,
      clientId: r.client_id || null,
      notes: r.notes || '',
    }));
  } catch (e) {
    console.warn('[loadExpenses] exception (table may not exist):', e);
    DB.expenses = [];
  }
}

/**
 * Save or update an expense
 */
export async function saveExpense(exp: Expense): Promise<any> {
  try {
    const row: any = {
      date: exp.date,
      category: exp.category,
      vendor: exp.vendor || '',
      description: exp.description || '',
      amount: exp.amount,
      invoice_id: exp.invoiceId || null,
      client_id: exp.clientId || null,
      notes: exp.notes || '',
    };

    if (exp.id) row.id = exp.id;

    const { data, error } = await supabase
      .from('expenses')
      .upsert(row, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('[saveExpense] error (table may not exist):', error.code || error.message);
      return null;
    }

    return data && data[0] ? data[0] : null;
  } catch (e) {
    console.warn('[saveExpense] exception (table may not exist):', e);
    return null;
  }
}

/**
 * Delete an expense by ID
 */
export async function deleteExpenseById(expId: string): Promise<void> {
  try {
    if (!expId) return;

    const { error } = await supabase.from('expenses').delete().eq('id', expId);

    if (error) {
      console.warn('[deleteExpenseById] error (table may not exist):', error.code || error.message);
    }
  } catch (e) {
    console.warn('[deleteExpenseById] exception (table may not exist):', e);
  }
}

/**
 * Load agency settings
 */
export async function loadAgencySettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('agency_settings')
      .select('*')
      .limit(1);

    if (error) {
      console.warn('[loadAgencySettings] table may not exist:', error.code || error.message);
      // Keep defaults — do not modify DB.agencySettings
      return;
    }

    if (!data || !Array.isArray(data) || data.length === 0) return;

    DB.agencySettings.taxRate = parseFloat(data[0].tax_rate) || 28;
    DB.agencySettings.fiscalYearStart = parseInt(data[0].fiscal_year_start) || 1;

    if (
      data[0].payment_methods &&
      Array.isArray(data[0].payment_methods) &&
      data[0].payment_methods.length > 0
    ) {
      DB.agencySettings.paymentMethods = data[0].payment_methods;
    }

    if (data[0].agency_name) DB.agency.name = data[0].agency_name;
    if (data[0].founder_name) DB.agency.founder = data[0].founder_name;
    if (data[0].website) DB.agency.url = data[0].website;
    if (data[0].city) DB.agency.location = data[0].city;
  } catch (e) {
    console.warn('[loadAgencySettings] exception (table may not exist):', e);
    // Keep defaults — do not modify DB.agencySettings
  }
}

/**
 * Save agency settings
 */
export async function saveAgencySettings(
  taxRate: number,
  fiscalYearStart: number,
  paymentMethods?: any[],
  agencyInfo?: any
): Promise<void> {
  // Always update local cache regardless of whether persistence works
  DB.agencySettings.taxRate = taxRate;
  DB.agencySettings.fiscalYearStart = fiscalYearStart;

  if (paymentMethods) {
    DB.agencySettings.paymentMethods = paymentMethods;
  }

  if (agencyInfo) {
    if (agencyInfo.agencyName) DB.agency.name = agencyInfo.agencyName;
    if (agencyInfo.founderName) DB.agency.founder = agencyInfo.founderName;
    if (agencyInfo.website) DB.agency.url = agencyInfo.website;
    if (agencyInfo.city) DB.agency.location = agencyInfo.city;
  }

  // Attempt persistence — gracefully handle missing table
  try {
    const { data, error: selectErr } = await supabase
      .from('agency_settings')
      .select('id')
      .limit(1);

    if (selectErr) {
      console.warn('[saveAgencySettings] table may not exist:', selectErr.code || selectErr.message);
      return;
    }

    const row: any = {
      tax_rate: taxRate,
      fiscal_year_start: fiscalYearStart,
    };

    if (paymentMethods) {
      row.payment_methods = paymentMethods;
    }

    if (agencyInfo) {
      if (agencyInfo.agencyName) row.agency_name = agencyInfo.agencyName;
      if (agencyInfo.founderName) row.founder_name = agencyInfo.founderName;
      if (agencyInfo.website) row.website = agencyInfo.website;
      if (agencyInfo.city) row.city = agencyInfo.city;
    }

    console.log('[saveAgencySettings] Saving row:', JSON.stringify(row).substring(0, 200));

    if (data && data.length > 0) {
      row.id = data[0].id;
      const { error } = await supabase
        .from('agency_settings')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        console.warn('[saveAgencySettings] upsert error:', error.code || error.message);
      } else {
        console.log('[saveAgencySettings] Upsert successful');
      }
    } else {
      const { error } = await supabase.from('agency_settings').insert(row);

      if (error) {
        console.warn('[saveAgencySettings] insert error:', error.code || error.message);
      }
    }
  } catch (e) {
    console.warn('[saveAgencySettings] exception (table may not exist):', e);
  }
}

// ============================================================================
// Notes
// ============================================================================

function mapNote(row: any): Note {
  return {
    id: row.id,
    createdAt: row.created_at,
    clientId: row.client_id ?? null,
    contactId: row.contact_id ?? null,
    content: row.content,
    kind: row.kind,
    sourceKind: row.source_kind ?? null,
  };
}

export async function loadClientNotes(clientId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[loadClientNotes] error:', error);
    return [];
  }
  return (data || []).map(mapNote);
}

export async function createClientNote(clientId: string, content: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ client_id: clientId, content, kind: 'note', source_kind: 'manual' })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[createClientNote] error:', error);
    throw new Error(error?.message || 'Failed to create note');
  }
  return mapNote(data);
}

// ============================================================================
// CRM Contacts
// ============================================================================

function mapCrmContact(row: any): CrmContact {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    avatarUrl: row.avatar_url ?? null,
    kind: row.kind,
    tags: row.tags ?? [],
    clientId: row.client_id ?? null,
    role: row.role ?? null,
    isPrimaryContact: row.is_primary_contact ?? false,
    isBillingContact: row.is_billing_contact ?? false,
    context: row.context ?? null,
    metAtDate: row.met_at_date ?? null,
    metAtLocation: row.met_at_location ?? null,
    links: row.links ?? [],
  };
}

export async function loadClientContacts(clientId: string): Promise<CrmContact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('is_primary_contact', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[loadClientContacts] error:', error);
    return [];
  }
  return (data || []).map(mapCrmContact);
}

export async function createClientContact(
  clientId: string,
  data: { name: string; role?: string; email?: string; phone?: string; isPrimaryContact?: boolean; isBillingContact?: boolean }
): Promise<CrmContact> {
  const { data: row, error } = await supabase
    .from('contacts')
    .insert({
      client_id: clientId,
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      is_primary_contact: data.isPrimaryContact ?? false,
      is_billing_contact: data.isBillingContact ?? false,
      kind: 'client_contact',
    })
    .select('*')
    .single();
  if (error || !row) {
    console.error('[createClientContact] error:', error);
    throw new Error(error?.message || 'Failed to create contact');
  }
  return mapCrmContact(row);
}

// ============================================================================
// Tasks
// ============================================================================

function mapTask(row: any): Task {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id ?? null,
    contactId: row.contact_id ?? null,
    eventId: row.event_id ?? null,
    title: row.title,
    dueDate: row.due_date ?? null,
    leadDays: row.lead_days ?? null,
    completedAt: row.completed_at ?? null,
    sourceNoteId: row.source_note_id ?? null,
  };
}

export async function loadClientTasks(clientId: string): Promise<Task[]> {
  // Load open tasks first (by due_date asc), then completed (by completed_at desc)
  const [openRes, doneRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .is('completed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }),
  ]);
  if (openRes.error) console.error('[loadClientTasks] open error:', openRes.error);
  if (doneRes.error) console.error('[loadClientTasks] done error:', doneRes.error);
  const open = (openRes.data || []).map(mapTask);
  const done = (doneRes.data || []).map(mapTask);
  return [...open, ...done];
}

export async function createClientTask(
  clientId: string,
  data: { title: string; dueDate?: string | null; eventId?: string | null; leadDays?: number | null }
): Promise<Task> {
  const { data: row, error } = await supabase
    .from('tasks')
    .insert({
      client_id: clientId,
      title: data.title,
      due_date: data.dueDate || null,
      event_id: data.eventId || null,
      lead_days: data.leadDays ?? null,
    })
    .select('*')
    .single();
  if (error || !row) {
    console.error('[createClientTask] error:', error);
    throw new Error(error?.message || 'Failed to create task');
  }
  return mapTask(row);
}

export async function setTaskCompleted(taskId: string, completed: boolean): Promise<Task> {
  const { data: row, error } = await supabase
    .from('tasks')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error || !row) {
    console.error('[setTaskCompleted] error:', error);
    throw new Error(error?.message || 'Failed to update task');
  }
  return mapTask(row);
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error('[deleteTask] error:', error);
    throw new Error(error?.message || 'Failed to delete task');
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) {
    console.error('[deleteNote] error:', error);
    throw new Error(error?.message || 'Failed to delete note');
  }
}

// ============================================================================
// Events
// ============================================================================

function mapEvent(row: any): Event {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id ?? null,
    contactId: row.contact_id ?? null,
    title: row.title,
    eventDate: row.event_date,
    location: row.location ?? null,
    description: row.description ?? null,
    sourceNoteId: row.source_note_id ?? null,
  };
}

export async function loadClientEvents(clientId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('client_id', clientId)
    .order('event_date', { ascending: true });
  if (error) {
    console.error('[loadClientEvents] error:', error);
    return [];
  }
  return (data || []).map(mapEvent);
}

export async function createClientEvent(
  clientId: string,
  data: { title: string; eventDate: string; location?: string; description?: string }
): Promise<Event> {
  const { data: row, error } = await supabase
    .from('events')
    .insert({
      client_id: clientId,
      title: data.title,
      event_date: data.eventDate,
      location: data.location || null,
      description: data.description || null,
    })
    .select('*')
    .single();
  if (error || !row) {
    console.error('[createClientEvent] error:', error);
    throw new Error(error?.message || 'Failed to create event');
  }
  return mapEvent(row);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    console.error('[deleteEvent] error:', error);
    throw new Error(error?.message || 'Failed to delete event');
  }
}
