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
