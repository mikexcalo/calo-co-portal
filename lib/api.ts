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
