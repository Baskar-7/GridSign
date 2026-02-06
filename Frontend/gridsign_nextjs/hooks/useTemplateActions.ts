import { useCallback } from 'react';
import { toast } from 'sonner';

interface DeleteTemplateResult {
  status: string;
  message?: string;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Centralized template actions (currently only delete)
export function useTemplateActions() {
  const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0,-1) : baseUrl;
  const apiRoot = /\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`;

  const deleteTemplate = useCallback(async (templateId: string): Promise<DeleteTemplateResult> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    try {
      const resp = await fetch(`${apiRoot}/template/${templateId}`, {
        method: 'DELETE',
        headers,
      });
      // Handle 401 similar to getAllTemplates flow
      if (resp.status === 401) {
        toast.error('Session Expired');
        try { localStorage.removeItem('token'); } catch {}
        if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
          setTimeout(() => { window.location.href = '/signin'; }, 600);
        }
        return { status: 'unauthorized', message: 'Unauthorized' };
      }
      let json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { json = await resp.json(); } catch { json = {}; }
      const status = json?.status || json?.Status || (resp.ok ? 'success' : 'error');
      return { status, message: json?.message || json?.Message, data: json?.data || json?.Data };
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      return { status: 'error', message: e.message || 'Network error' };
    }
  }, [apiRoot]);

  return { deleteTemplate };
}
