import type { ReportExtendedDto } from '@/types/report';

// Escape CSV field (wrap in quotes if needed and escape internal quotes)
function esc(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export interface BuildCsvOptions {
  includeAboutSection?: boolean;
  helpTexts?: Record<string,string>;
}

export function buildExtendedReportCSV(extended: ReportExtendedDto, opts: BuildCsvOptions = {}): string {
  const lines: string[] = [];
  lines.push('Generated At,' + esc(extended.generatedAt));
  lines.push('Range Start,' + esc(extended.rangeStart));
  lines.push('Range End,' + esc(extended.rangeEnd));
  const summary = extended.summary;
  lines.push('');
  lines.push('Summary Status Counts');
  lines.push('Total,' + summary.total);
  lines.push('Completed,' + summary.completed);
  lines.push('In Progress,' + summary.inProgress);
  lines.push('Draft,' + summary.draft);
  lines.push('Expired,' + summary.expired);
  lines.push('Cancelled,' + summary.cancelled);
  lines.push('Failed,' + summary.failed);
  if (extended.averages) {
    lines.push('Completion Rate (%),' + extended.averages.completionRatePct);
    lines.push('Avg Completion Time (Days),' + extended.averages.avgCompletionTimeDays);
  }
  lines.push('');
  // Template usage
  lines.push('Template Usage');
  lines.push('Template ID,Template Name,Total,Completed,AvgCompletionDays,SuccessRatePct');
  extended.templateUsage.forEach(t => {
    lines.push([
      t.templateId,
      esc(t.templateName),
      t.total,
      t.completed,
      t.avgCompletionDays,
      t.successRatePct
    ].join(','));
  });
  lines.push('');
  // Upcoming expirations
  lines.push('Upcoming Expirations');
  lines.push('WorkflowId,WorkflowName,ValidUntil,DaysRemaining');
  extended.upcomingExpirations.forEach(u => {
    lines.push([
      u.workflowId,
      esc(u.workflowName),
      esc(u.validUntil),
      u.daysRemaining
    ].join(','));
  });
  lines.push('');
  // Metrics history
  lines.push('Metrics History');
  lines.push('Date,Total,Completed,InProgress,Draft,Expired,Cancelled,Failed');
  extended.metricsHistory.forEach(m => {
    lines.push([
      esc(m.date),
      m.total,
      m.completed,
      m.inProgress,
      m.draft,
      m.expired,
      m.cancelled,
      m.failed
    ].join(','));
  });
  if (opts.includeAboutSection) {
    lines.push('');
    lines.push('About These Metrics');
    const help = opts.helpTexts || {};
    Object.entries(help).forEach(([k,v]) => {
      lines.push(`${esc(k)},${esc(v)}`);
    });
  }
  return lines.join('\n');
}

export function triggerExtendedReportDownload(extended: ReportExtendedDto, filename = 'gridsign-report.csv', opts: BuildCsvOptions = {}) {
  try {
    const csv = buildExtendedReportCSV(extended, opts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to export report', e);
    throw e;
  }
}
