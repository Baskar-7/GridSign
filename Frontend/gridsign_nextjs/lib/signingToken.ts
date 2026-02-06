// Helper utilities for signing token handling
// Keeps logic isolated & testable.

export function appendSigningToken(fd: FormData, token?: string) {
  if (!token) throw new Error('Missing signing token');
  fd.append('Token', token);
}

export function extractSigningParams(search: string) {
  const sp = new URLSearchParams(search.startsWith('?') ? search.substring(1) : search);
  const token = sp.get('token') || null;
  const recipientIdRaw = sp.get('recipientId');
  const recipientId = recipientIdRaw ? Number(recipientIdRaw) : null;
  return { token, recipientId: recipientId && !Number.isNaN(recipientId) ? recipientId : null };
}
