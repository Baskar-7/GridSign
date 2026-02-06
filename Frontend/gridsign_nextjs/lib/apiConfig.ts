export const BASE_API_URL =
  process.env.NEXT_PUBLIC_LOCAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

// Helper to build full URL if a relative path is passed
export const apiUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  const base = (BASE_API_URL || '').replace(/\/+$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  const needsDedup = base.endsWith('/api') && rel.startsWith('/api/');
  const relNormalized = needsDedup ? rel.substring(4) : rel;
  return `${base}${relNormalized}`;
};