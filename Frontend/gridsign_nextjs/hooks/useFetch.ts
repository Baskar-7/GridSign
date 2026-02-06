import { useState, useCallback } from "react";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

// Define base URL with type checking
const BASE_URL = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface UseFetchOptions<T = any> {
    method?: HttpMethod;
    defaultHeaders?: Record<string, string>; // Changed from headers to defaultHeaders
    onSuccess?: (data: T) => void;
    onError?: (error: AxiosError) => void;
}

interface UseFetchReturn<T = any> {
    data: T | null;
    error: AxiosError | null;
    loading: boolean;
    execute: (
        url: string,
        body?: any,
        config?: AxiosRequestConfig
    ) => Promise<T | null>;
    reset: () => void;
}

/**
 * Custom hook for making HTTP requests using Axios
 *
 * @param options - Configuration options for the hook
 * @returns Object containing data, error, loading state, execute function, and reset function
 *
 * @example
 * // GET request
 * const { data, loading, error, execute } = useFetch({ method: "GET" });
 * execute("/api/users");
 *
 * @example
 * // POST request
 * const { data, loading, error, execute } = useFetch({
 *   method: "POST",
 *   onSuccess: (data) => console.log("Success:", data)
 * });
 * execute("/api/users", { name: "John", email: "john@example.com" });
 *
 * @example
 * // PUT request with custom headers
 * const { data, loading, error, execute } = useFetch({
 *   method: "PUT",
 *   headers: { "Authorization": "Bearer token" }
 * });
 * execute("/api/users/1", { name: "John Updated" });
 *
 * @example
 * // DELETE request
 * const { data, loading, error, execute } = useFetch({ method: "DELETE" });
 * execute("/api/users/1");
 */
export function useFetch<T = any>(
    options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
    const {
        method = "GET",
        defaultHeaders = {},
        onSuccess,
        onError,
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<AxiosError | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    /**
     * Execute the HTTP request
     * @param url - The endpoint URL
     * @param body - Request body (for POST, PUT, PATCH)
     * @param config - Additional Axios configuration
     */
    const execute = useCallback(
        async (
            url: string,
            body?: any,
            config?: AxiosRequestConfig
        ): Promise<T | null> => {
            if (!url) {
                throw new Error('URL is required');
            }

            setLoading(true);
            setError(null);
            setData(null); // Reset data before new request

            try {
                const token = typeof window !== "undefined" 
                    ? localStorage.getItem("token") 
                    : null;

                const headers = {
                    "Content-Type": "application/json",
                    ...defaultHeaders,
                    ...(token && { Authorization: `Bearer ${token}` }),
                    ...(config?.headers || {}),
                };

                // Ensure URL is properly formatted
                const finalUrl = url.startsWith('http') 
                    ? url 
                    : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

                let response: AxiosResponse<T>;

                const axiosConfig = {
                    headers,
                    ...config,
                };

                switch (method) {
                    case "GET":
                        response = await axios.get<T>(finalUrl, axiosConfig);
                        break;
                    case "POST":
                        response = await axios.post<T>(finalUrl, body, axiosConfig);
                        break;
                    case "PUT":
                        response = await axios.put<T>(finalUrl, body, axiosConfig);
                        break;
                    case "DELETE":
                        response = await axios.delete<T>(finalUrl, axiosConfig);
                        break;
                    case "PATCH":
                        response = await axios.patch<T>(finalUrl, body, axiosConfig);
                        break;
                    default:
                        throw new Error(`Unsupported HTTP method: ${method}`);
                }

                const responseData = response.data;
                setData(responseData);
                onSuccess?.(responseData);
                return responseData;

            } catch (err) {
                const error = err as Error | AxiosError;
                const errorMessage = axios.isAxiosError(error)
                    ? error.response?.data?.message || error.message
                    : error.message;

                const finalError = axios.isAxiosError(error)
                    ? error
                    : new Error(errorMessage) as AxiosError;

                setError(finalError);
                onError?.(finalError);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [method, defaultHeaders, onSuccess, onError]
    );

    /**
     * Reset the hook state
     */
    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    return { data, error, loading, execute, reset };
}

/**
 * Shorthand hooks for specific HTTP methods
 */

export const useGet = <T = any>(options?: Omit<UseFetchOptions<T>, "method">) =>
    useFetch<T>({ ...options, method: "GET" });

export const usePost = <T = any>(
    options?: Omit<UseFetchOptions<T>, "method">
) => useFetch<T>({ ...options, method: "POST" });

export const usePut = <T = any>(options?: Omit<UseFetchOptions<T>, "method">) =>
    useFetch<T>({ ...options, method: "PUT" });

export const useDelete = <T = any>(
    options?: Omit<UseFetchOptions<T>, "method">
) => useFetch<T>({ ...options, method: "DELETE" });

export const usePatch = <T = any>(
    options?: Omit<UseFetchOptions<T>, "method">
) => useFetch<T>({ ...options, method: "PATCH" });
