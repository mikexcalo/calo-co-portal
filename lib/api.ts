export async function parseEventFromText(text: string): Promise<{
  title: string;
  eventDate: string | null;
  location: string | null;
  description: string | null;
}> {
  const res = await fetch('/api/parse-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to parse event');
  }

  return res.json();
}

export type TranscriptEvent = {
  title: string;
  eventDate: string | null;
  location: string | null;
  description: string | null;
};

export type TranscriptTask = {
  title: string;
  dueDate: string | null;
  leadDays: number | null;
  anchorEventTitle: string | null;
};

export async function parseTranscript(text: string): Promise<{
  events: TranscriptEvent[];
  tasks: TranscriptTask[];
}> {
  const res = await fetch('/api/parse-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to parse transcript');
  }

  return res.json();
}

export type ParsedContact = {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  kind: 'lead' | 'prospect' | 'client_contact' | 'talent' | 'vendor' | 'friend';
  note: string | null;
};

export async function parseContactsFromNotes(text: string): Promise<{
  contacts: ParsedContact[];
}> {
  const res = await fetch('/api/parse-contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to parse contacts');
  }

  return res.json();
}
