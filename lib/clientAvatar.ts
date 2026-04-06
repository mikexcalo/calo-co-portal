function isImage(f: any): boolean {
  return /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(f.name || '');
}

export function getClientAvatarUrl(client: any): string | null {
  const bk = client?.brandKit;
  if (!bk?.logos) return client?.logo || null;

  const priority = ['favicon', 'icon', 'color', 'light', 'dark', 'secondary'];
  for (const slot of priority) {
    const files = bk.logos[slot];
    if (!files?.length) continue;
    const primary = files.find((f: any) => f.isPrimary && isImage(f)) || files.find((f: any) => isImage(f));
    if (primary?.data) return primary.data;
  }
  return client?.logo || null;
}
