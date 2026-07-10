/** Prefer the edge fn's JSON `{ error }` (HttpErrorResponse.error.error) over the
 *  generic HttpClient message; fall back to the raw Error message or a default. */
export function edgeErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as { error?: unknown }).error;
    if (inner && typeof inner === 'object' && 'error' in inner) {
      const msg = (inner as { error?: unknown }).error;
      if (typeof msg === 'string') return msg;
    }
  }
  return err instanceof Error ? err.message : fallback;
}
