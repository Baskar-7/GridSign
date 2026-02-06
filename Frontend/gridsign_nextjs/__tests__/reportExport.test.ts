import { describe, it, expect } from 'vitest';
import { buildExtendedReportCSV } from '@/lib/reportExport';
import { REPORT_HELP_TEXTS } from '@/lib/reportHelpTexts';
import type { ReportExtendedDto } from '@/types/report';

function sampleExtended(): ReportExtendedDto {
  return {
    generatedAt: '2025-11-07T12:00:00Z',
    rangeStart: '2025-11-01',
    rangeEnd: '2025-11-07',
    averages: { avgCompletionTimeDays: 2.5, completionRatePct: 60 },
    summary: {
      total: 10,
      completed: 6,
      inProgress: 2,
      draft: 1,
      expired: 1,
      cancelled: 0,
      failed: 0,
      recent: []
    },
    weeklyActivity: [],
    templateUsage: [
      { templateId: 1, templateName: 'NDA', total: 5, completed: 3, avgCompletionDays: 1.2, successRatePct: 60 },
      { templateId: 2, templateName: 'MSA', total: 5, completed: 3, avgCompletionDays: 3.8, successRatePct: 60 }
    ],
    metricsHistory: [
      { date: '2025-11-01', total: 2, completed: 1, inProgress: 1, draft: 0, expired: 0, cancelled: 0, failed: 0 },
      { date: '2025-11-02', total: 4, completed: 2, inProgress: 1, draft: 1, expired: 0, cancelled: 0, failed: 0 }
    ],
    upcomingExpirations: [
      { workflowId: 101, workflowName: 'Onboarding Packet', validUntil: '2025-11-10', daysRemaining: 3 }
    ]
  } as any;
}

describe('buildExtendedReportCSV', () => {
  it('includes key sections and headers', () => {
    const csv = buildExtendedReportCSV(sampleExtended(), { includeAboutSection: true, helpTexts: REPORT_HELP_TEXTS });
    expect(csv).toContain('Summary Status Counts');
    expect(csv).toContain('Template Usage');
    expect(csv).toContain('Upcoming Expirations');
    expect(csv).toContain('Metrics History');
    expect(csv).toContain('About These Metrics');
  });

  it('renders template rows', () => {
    const csv = buildExtendedReportCSV(sampleExtended(), { includeAboutSection: true, helpTexts: REPORT_HELP_TEXTS });
    expect(csv).toMatch(/NDA/);
    expect(csv).toMatch(/MSA/);
  });

  it('escapes commas and quotes', () => {
    const ext = sampleExtended();
    ext.templateUsage.push({ templateId: 3, templateName: 'Quote, "Special"', total: 1, completed: 1, avgCompletionDays: 0.5, successRatePct: 100 });
  const csv = buildExtendedReportCSV(ext, { includeAboutSection: true, helpTexts: REPORT_HELP_TEXTS });
    // Field should be wrapped in quotes and internal quotes doubled
    expect(csv).toMatch(/"Quote, ""Special"""/);
  });
});
