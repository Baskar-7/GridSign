import { useState, useEffect } from 'react';

export interface UseFileResourceOptions {
  fileResourceId: number;
  enabled?: boolean;
}

export function useFileResource({ fileResourceId, enabled = true }: UseFileResourceOptions) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !fileResourceId) {
      setFileUrl(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchFile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No auth token available');

        const API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_URL?.replace(/\/$/, '') || 'http://localhost:5035/api';
        const response = await fetch(`${API_BASE}/fileresource/${fileResourceId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        if (isMounted) {
          setSize(blob.size);
          const ct = response.headers.get('content-type');
            setContentType(ct);
          if (blob.size === 0) {
            // Attempt to fetch meta to aid debugging
            try {
              const metaResp = await fetch(`${API_BASE}/fileresource/${fileResourceId}/meta`, { headers: { Authorization: `Bearer ${token}` } });
              if (metaResp.ok) {
                const meta = await metaResp.json();
                if ((meta?.Size ?? 0) === 0) {
                  throw new Error('File resource has zero bytes on server.');
                }
              }
            } catch (metaErr:any) {
              setError(metaErr instanceof Error ? metaErr : new Error('Zero-byte file and meta fetch failed'));
              setFileUrl(null);
              return;
            }
          }
          const objectUrl = URL.createObjectURL(blob);
          setFileUrl(objectUrl);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFile();

    return () => {
      isMounted = false;
      controller.abort();
      // Cleanup any created object URLs
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileResourceId, enabled]);

  return { fileUrl, loading, error, size, contentType };
}
