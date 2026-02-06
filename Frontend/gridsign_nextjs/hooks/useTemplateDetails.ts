import { useApiQuery } from '@/hooks/useApiQuery';
import { mapTemplateDetailsRawToUI, TemplateDetailsRaw, TemplateDetailsUI } from '@/types/template';

interface UseTemplateDetailsOptions {
  templateId: number | null | undefined;
  enabled?: boolean;
  staleTime?: number;
}

// Thin wrapper providing strongly typed template details fetching with transformation.
export const useTemplateDetails = (opts: UseTemplateDetailsOptions) => {
  const { templateId, enabled = true, staleTime = 15_000 } = opts;
  return useApiQuery<TemplateDetailsUI>({
    queryKey: ['template-details', templateId],
    method: 'GET',
    enabled: !!templateId && enabled && !Number.isNaN(templateId),
    url: `${process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000/api'}/template/getTemplateDetails?templateId=${templateId}`,
    // raw here is backend ApiResponse payload BEFORE outer hook wraps it again; handle both camelCase and PascalCase
    transform: (raw: any) => {
      const inner = raw?.Data || raw?.data || raw; // backend returns { Status, Message, Data }
      return mapTemplateDetailsRawToUI(inner as TemplateDetailsRaw);
    },
    staleTime,
  });
};

export type UseTemplateDetailsReturn = ReturnType<typeof useTemplateDetails>;
