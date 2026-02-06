export interface ReportWorkflowSummary {
  workFlowId: number;
  workFlowCreatorId: string; // Guid string
  workflowOwnerName?: string | null;
  workflowName?: string | null;
  createdOn: string; // ISO date
  lastUpdatedDate: string; // ISO date
  recipientConfiguration: number; // enum underlying value
  status: number; // enum WorkflowStatus underlying value
  validUntil: string; // DateOnly serialized
  reminderIntervalInDays: number;
  templateId: number;
  templateName?: string;
  isSequentialSigningEnabled: boolean;
}

export interface ReportSummaryDto {
  total: number;
  completed: number;
  inProgress: number;
  draft: number;
  expired: number;
  cancelled: number;
  failed: number;
  recent: ReportWorkflowSummary[];
}

// Extended report client-side types (mirror backend ReportExtendedDto)
export interface ActivityPoint { date: string; dayLabel: string; count: number; }
export interface TemplateUsagePoint { templateId: number; templateName: string; total: number; completed: number; avgCompletionDays: number; successRatePct: number; }
// Removed DailyStackedPoint, TopUserPoint, RecentEventPoint per request
export interface MetricsHistoryPoint { date: string; total: number; completed: number; inProgress: number; draft: number; expired: number; cancelled: number; failed: number; }
export interface UpcomingExpirationPoint { workflowId: number; workflowName: string; validUntil: string; daysRemaining: number; }
export interface ExpiringWorkflowDto { workflowId: number; workflowName: string; validUntil: string; daysRemaining: number; status: number; templateId: number; templateName: string; }
export interface QuickStatsBlock { totalDocuments: number; pending: number; completed: number; }
export interface CompletionInsightBlock { completionRatePct: number; trendDeltaPct: number; }
export interface SidebarReportDto { quickStats: QuickStatsBlock; expiringWorkflows: ExpiringWorkflowDto[]; completionInsights: CompletionInsightBlock; generatedAt: string; }
export interface AveragesBlock { avgCompletionTimeDays: number; completionRatePct: number; }
export interface ReportExtendedDto {
  summary: ReportSummaryDto;
  weeklyActivity: ActivityPoint[];
  templateUsage: TemplateUsagePoint[];
  metricsHistory: MetricsHistoryPoint[];
  upcomingExpirations: UpcomingExpirationPoint[];
  averages: AveragesBlock;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}
