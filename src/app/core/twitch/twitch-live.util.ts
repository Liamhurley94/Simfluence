// Pure formatting helper — extracted from CreatorProfileModalComponent.lastStreamPhrase
// so it can be unit-tested without the full Angular component machinery.
export function lastStreamPhrase(days: number | null): string {
  if (days == null) return 'recently';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
