import { useApiQuery } from '@/hooks/useApiQuery';
import type { ReportExtendedDto } from '@/types/report';

export function useExtendedReports(dateRange: string = '7d') {
  const enabled = typeof window !== 'undefined' && !!localStorage.getItem('token');
  return useApiQuery<ReportExtendedDto>({
    queryKey: ['reports','extended', dateRange],
    url: `/api/reports/extended?dateRange=${encodeURIComponent(dateRange)}`,
    method: 'GET',
    enabled,
    staleTime: 60_000,
  });
}