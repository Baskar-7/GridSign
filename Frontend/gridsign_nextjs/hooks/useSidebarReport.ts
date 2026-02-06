import { useApiQuery } from '@/hooks/useApiQuery';
import type { SidebarReportDto } from '@/types/report';

export function useSidebarReport(expiringDays: number = 14, expiringLimit: number = 8) {
  const enabled = typeof window !== 'undefined' && !!localStorage.getItem('token');
  return useApiQuery<SidebarReportDto>({
    queryKey: ['reports','sidebar', expiringDays, expiringLimit],
    url: `/api/reports/sidebar?expiringDays=${expiringDays}&expiringLimit=${expiringLimit}`,
    method: 'GET',
    enabled,
    staleTime: 30_000,
  });
}
