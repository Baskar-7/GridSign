import { useApiQuery } from '@/hooks/useApiQuery';
import type { ExpiringWorkflowDto, ApiResponse } from '@/types/report';

export function useExpiringWorkflows(days: number = 14, limit: number = 50) {
  const enabled = typeof window !== 'undefined' && !!localStorage.getItem('token');
  return useApiQuery<ExpiringWorkflowDto[]>({
    queryKey: ['reports','expiring', days, limit],
    url: `/api/reports/expiring?days=${days}&limit=${limit}`,
    method: 'GET',
    enabled,
    staleTime: 30_000,
  });
}
