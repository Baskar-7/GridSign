export const REPORT_HELP_TEXTS: Record<string,string> = {
  totalWorkflows: 'Total workflows created in the selected date range.',
  completed: 'Workflows that reached a Completed status within the range.',
  inProgress: 'Workflows currently active and not yet completed or cancelled.',
  draft: 'Workflows created but not yet started (still in Draft).',
  workflowActivity: 'Daily count of workflows created (uses CreatedOn date).',
  templateUsage: 'Distribution of workflows by template with completion & average duration.',
  statusDistribution: 'Current counts of workflows per status filtered by legend selection.',
  upcomingExpirations: 'Active workflows expiring in the next 14 days (not completed or cancelled).',
  dailyStatusTrend: 'Last 14 days per-day totals and key status counts for trend analysis.',
  workflowSummary: 'Per-template totals, completion counts, average completion time and success rate.'
};

export const ORDERED_HELP_KEYS = [
  'totalWorkflows',
  'completed',
  'inProgress',
  'draft',
  'workflowActivity',
  'templateUsage',
  'statusDistribution',
  'upcomingExpirations',
  'dailyStatusTrend',
  'workflowSummary'
];
