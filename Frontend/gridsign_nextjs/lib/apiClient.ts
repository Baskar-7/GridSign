import axios, { AxiosError } from 'axios';

// Prefer explicit local override; fall back to public API; ensure /api suffix is present for consistency.
const RAW_BASE = process.env.NEXT_PUBLIC_LOCAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5164';

function ensureApiSuffix(base: string) {
  const trimmed = base.replace(/\/+$/, '');
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}
const BASE_URL = ensureApiSuffix(RAW_BASE);

function normalizeBase(base: string) {
  return base.replace(/\/+$/, '');
}

export function resolveApiUrl(relative: string): string {
  const baseTrimmed = normalizeBase(BASE_URL || '');
  if (relative.startsWith('http')) return relative; // already full
  // Strip any leading '/api/' from relative because BASE_URL already guarantees /api suffix
  let rel = relative.startsWith('/') ? relative : `/${relative}`;
  if (/^\/api\//i.test(rel)) rel = rel.replace(/^\/api/i, '');
  return `${baseTrimmed}${rel}`;
}

export interface ApiErrorShape {
  statusCode?: number;
  message?: string;
  data?: any;
}

export async function postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  try {
    const res = await axios.post<T>(url, formData, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // DO NOT set Content-Type explicitly; browser/axios will set multipart boundary.
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axErr: AxiosError = err;
      const status = axErr.response?.status;
      const data = axErr.response?.data;
  const msg = typeof data === 'object' && data !== null ? ( (data as any).message || (data as any).Message ) : undefined;
  const message = msg || axErr.message;
      if (status === 401 && typeof window !== 'undefined') {
        try { localStorage.removeItem('token'); } catch {}
        if (window.location.pathname !== '/signin') {
          window.location.href = '/signin';
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[apiClient.postFormData] error', { url, status, data });
      }
      throw { statusCode: status, message, data } as ApiErrorShape;
    }
    throw { message: 'Unknown error' } as ApiErrorShape;
  }
}

export async function postJson<T = any>(endpoint: string, body?: any): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  try {
    const res = await axios.post<T>(url, body ?? {}, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axErr: AxiosError = err;
      const status = axErr.response?.status;
      const data = axErr.response?.data;
      const msg = typeof data === 'object' && data !== null ? ((data as any).message || (data as any).Message) : undefined;
      const message = msg || axErr.message;
      if (status === 401 && typeof window !== 'undefined') {
        try { localStorage.removeItem('token'); } catch {}
        if (window.location.pathname !== '/signin') {
          window.location.href = '/signin';
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[apiClient.postJson] error', { url, status, data });
      }
      throw { statusCode: status, message, data } as ApiErrorShape;
    }
    throw { message: 'Unknown error' } as ApiErrorShape;
  }
}
