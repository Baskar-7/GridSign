import {
    useQuery as useTanstackQuery,
    UseQueryOptions,
    UseQueryResult,
} from "@tanstack/react-query";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { ApiResponse } from "@/types/api";

const BASE_URL = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';

// Global in-flight request registry (module scoped) to dedupe duplicate mounts (React 18 StrictMode double render)
// Key: serialized(queryKey)+method+fullUrl+bodyHash
// Value: shared promise resolving to ApiResponse<T>
const inFlightRequests: Record<string, Promise<any>> = {};

interface UseApiQueryOptions<T = any>
    extends Omit<
        UseQueryOptions<ApiResponse<T>, AxiosError>,
        "queryKey" | "queryFn"
    > {
    url?: string;
    endpoint?: string;
    method?: 'GET' | 'POST';
    body?: any; // JSON serializable request payload for POST
    transform?: (data: any) => T;
    config?: AxiosRequestConfig;
}

/**
 * Custom hook for GET requests using TanStack Query (React Query)
 *
 * @param queryKey - Unique key for the query (for caching)
 * @param options - Configuration options including url, axios config, and react-query options
 * @returns UseQueryResult with data, error, loading states, and refetch function
 *
 * @example
 * ```tsx
 * const { data, error, isLoading, refetch } = useApiQuery(
 *   ['users', userId],
 *   {
 *     url: `/api/users/${userId}`,
 *     enabled: !!userId, // Only run query if userId exists
 *     staleTime: 5000, // Consider data fresh for 5 seconds
 *   }
 * );
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (data?.status === 'success') return <div>{data.data.name}</div>;
 * ```
 */
export function useApiQuery<T = any>({
    queryKey,
    url,
    endpoint,
    method = 'GET',
    body,
    config,
    transform,
    ...queryOptions
}: UseApiQueryOptions<T> & { queryKey: unknown[] }): UseQueryResult<ApiResponse<T>, AxiosError> {
    const finalUrl = url || endpoint;

    if (!finalUrl) {
        throw new Error('Either url or endpoint must be provided to useApiQuery');
    }

    // Construct full URL if relative path provided, with normalization to avoid double '/api/api'
    let fullUrl: string;
    if (finalUrl.startsWith('http')) {
        fullUrl = finalUrl;
    } else {
        const baseTrimmed = (BASE_URL || '').replace(/\/+$/, ''); // remove trailing slashes
        const rel = finalUrl.startsWith('/') ? finalUrl : `/${finalUrl}`;
        // If base ends with /api and relative also starts with /api/, drop one occurrence
        const needsDedup = baseTrimmed.endsWith('/api') && rel.startsWith('/api/');
        const relNormalized = needsDedup ? rel.substring(4) : rel; // remove leading '/api'
        fullUrl = `${baseTrimmed}${relNormalized}`;
    }

    return useTanstackQuery<ApiResponse<T>, AxiosError>({
        ...queryOptions,
        queryKey,
        queryFn: async (): Promise<ApiResponse<T>> => {
            try {
                const token = typeof window !== "undefined" 
                    ? localStorage.getItem("token") 
                    : null;

                const mergedConfig: AxiosRequestConfig = {
                    ...config,
                    headers: {
                        "Content-Type": "application/json",
                        ...config?.headers,
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                };

                // Build dedupe key
                const bodyHash = method === 'POST' && body ? JSON.stringify(body) : '';
                const dedupeKey = JSON.stringify(queryKey) + '|' + method + '|' + fullUrl + '|' + bodyHash;
                if (Object.prototype.hasOwnProperty.call(inFlightRequests, dedupeKey)) {
                    if (process.env.NODE_ENV !== 'production') {
                        // eslint-disable-next-line no-console
                        console.debug('[useApiQuery] deduped in-flight', dedupeKey);
                    }
                    const existing = await inFlightRequests[dedupeKey];
                    return existing;
                }
                const execPromise = (async () => {
                    let response: { data: ApiResponse<T> };
                    if (method === 'POST') {
                        if (process.env.NODE_ENV !== 'production') {
                            // eslint-disable-next-line no-console
                            console.debug('[useApiQuery] POST', fullUrl, { body, headers: mergedConfig.headers });
                        }
                        response = await axios.post<ApiResponse<T>>(fullUrl, body ?? {}, mergedConfig);
                    } else {
                        if (process.env.NODE_ENV !== 'production') {
                            // eslint-disable-next-line no-console
                            console.debug('[useApiQuery] GET', fullUrl, { headers: mergedConfig.headers });
                        }
                        response = await axios.get<ApiResponse<T>>(fullUrl, mergedConfig);
                    }
                    if (transform && response.data.data) {
                        response.data.data = transform(response.data.data);
                    }
                    if (process.env.NODE_ENV !== 'production') {
                        // eslint-disable-next-line no-console
                        console.debug('[useApiQuery] response', fullUrl, response.data);
                    }
                    return response.data;
                })();
                inFlightRequests[dedupeKey] = execPromise;
                try {
                    const result = await execPromise;
                    return result;
                } finally {
                    // Allow future refetches (not a cache replacement, only in-flight dedupe)
                    delete inFlightRequests[dedupeKey];
                }
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    if (process.env.NODE_ENV !== 'production') {
                        // eslint-disable-next-line no-console
                        console.debug('[useApiQuery] error', fullUrl, error.response?.status, error.response?.data);
                    }
                    if (error.response?.status === 401 && typeof window !== 'undefined') {
                        try { localStorage.removeItem('token'); } catch {}
                        if (window.location.pathname !== '/signin') {
                            window.location.href = '/signin';
                        }
                    }
                    throw error;
                }
                throw new Error('An unexpected error occurred');
            }
        },
    });
}

/**
 * Hook for queries with automatic retry and background refetching
 * Suitable for data that changes frequently
 */
export function useApiQueryWithRefetch<T = any>({
    queryKey,
    ...options
}: UseApiQueryOptions<T> & { queryKey: unknown[] }): UseQueryResult<ApiResponse<T>, AxiosError> {
    return useApiQuery<T>({
        queryKey,
        ...options,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 30000,
        retry: 2,
    });
}

/**
 * Hook for queries with long cache time
 * Suitable for data that rarely changes (e.g., user profile, settings)
 */
export function useApiQueryCached<T = any>({
    queryKey,
    ...options
}: UseApiQueryOptions<T> & { queryKey: unknown[] }): UseQueryResult<ApiResponse<T>, AxiosError> {
    return useApiQuery<T>({
        queryKey,
        ...options,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook for queries that should only run once
 * Suitable for static data or one-time fetches
 */
export function useApiQueryOnce<T = any>({
    queryKey,
    ...options
}: UseApiQueryOptions<T> & { queryKey: unknown[] }): UseQueryResult<ApiResponse<T>, AxiosError> {
    return useApiQuery<T>({
        queryKey,
        ...options,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
