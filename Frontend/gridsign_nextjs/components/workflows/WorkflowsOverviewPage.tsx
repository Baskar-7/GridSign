"use client";

import React, { useEffect, useMemo, useState } from "react";
import SigningModeBadge from './SigningModeBadge';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import {
  Search,
  Eye,
  Filter,
  Loader2,
  ArrowUpDown,
  CalendarDays,
  FileText,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ChevronDown,
  Calendar,
} from "lucide-react";

// API types & mapper
import {
  ApiResponseRaw,
  PagedResponseRaw,
  WorkflowSummaryRaw,
  mapWorkflowSummaryRawToUI,
  WorkflowRecordUI,
  uiStatusToBackend,
} from "@/types/workflow";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";

type WorkflowRecord = WorkflowRecordUI;

// Modern gradient status configuration
const statusConfig: Record<
  WorkflowRecord["status"],
  {
    label: string;
    gradient: string;
    bgGradient: string;
    icon: React.ComponentType<{ className?: string }>;
    textColor: string;
    borderColor: string;
  }
> = {
  completed: {
    label: "Completed",
    gradient: "from-emerald-500 to-teal-600",
    bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
    icon: CheckCircle2,
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-200/60 dark:border-emerald-800/60",
  },
  "in-progress": {
    label: "In Progress",
    gradient: "from-blue-500 to-indigo-600",
    bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    icon: Clock,
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200/60 dark:border-blue-800/60",
  },
  expired: {
    label: "Expired",
    gradient: "from-amber-500 to-orange-600",
    bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
    icon: AlertCircle,
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200/60 dark:border-amber-800/60",
  },
  cancelled: {
    label: "Cancelled",
    gradient: "from-red-500 to-rose-600",
    bgGradient: "from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30",
    icon: XCircle,
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-200/60 dark:border-red-800/60",
  },
  draft: {
    label: "Draft",
    gradient: "from-gray-400 to-slate-500",
    bgGradient: "from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30",
    icon: Circle,
    textColor: "text-gray-600 dark:text-gray-400",
    borderColor: "border-gray-200/60 dark:border-gray-700/60",
  },
  failed: {
    label: "Failed",
    gradient: "from-red-600 to-pink-700",
    bgGradient: "from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30",
    icon: XCircle,
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-200/60 dark:border-red-800/60",
  },
};

// Premium gradient status badge
const GradientStatusBadge: React.FC<{ status: WorkflowRecord["status"] }> = ({
  status,
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.borderColor} bg-gradient-to-br ${config.bgGradient} ${config.textColor} shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md hover:scale-105`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  );
};

// Removed local date helpers; using shared formatDateDDMMYYYY

const formatDaysRemaining = (days: number) => {
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
};

const WorkflowsOverviewPage: React.FC = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusSet, setStatusSet] = useState<Set<WorkflowRecord["status"]>>(
    new Set()
  );
  const [sortBy, setSortBy] = useState<
    | "workflowName"
    | "validUntil"
    | "status"
    | "creator"
    | "createdDate"
    | "updatedDate"
    | "id"
  >("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [mutableData, setMutableData] = useState<WorkflowRecord[]>([]);

  // Pagination
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(12);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // API config
  const baseUrl =
    process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:3000";
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const apiRoot = /\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`;

  const backendStatusesArray = useMemo(() => {
    if (statusSet.size === 0) return [] as number[];
    return Array.from(statusSet).map((s) => uiStatusToBackend(s));
  }, [statusSet]);

  const backendSortKey = (
    field:
      | "workflowName"
      | "validUntil"
      | "status"
      | "creator"
      | "createdDate"
      | "updatedDate"
      | "id"
  ): string => {
    switch (field) {
      case "workflowName":
        return "workflowname";
      case "validUntil":
        return "validuntil";
      case "status":
        return "status";
      case "creator":
        return "workflowowner";
      case "createdDate":
        return "createdon";
      case "updatedDate":
        return "lastupdateddate";
      case "id":
        return "workflowid";
      default:
        return "createdon";
    }
  };

  const workflowsQuery = useApiQuery<{
    items: WorkflowRecord[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
  }>({
    queryKey: [
      "workflows",
      currentPage,
      pageSize,
      search,
      sortBy,
      sortDir,
      backendStatusesArray.sort().join("-"),
    ],
    method: "POST",
    url: `${apiRoot}/workflow/getWorkflows`,
    body: {
      PageNumber: currentPage,
      PageSize: pageSize,
      SearchTerm: search || "",
      SortBy: backendSortKey(sortBy),
      IsDescending: sortDir === "desc",
      Statuses: backendStatusesArray.length > 0 ? backendStatusesArray : null,
    },
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("token"),
    staleTime: 10_000,
    transform: (raw: any) => {
      try {
        const rawValues: WorkflowSummaryRaw[] = raw?.items?.$values ?? [];
        const mapped = rawValues.map(mapWorkflowSummaryRawToUI);

        return {
          items: mapped,
          totalCount: raw?.totalCount || mapped.length,
          pageNumber: raw?.pageNumber || currentPage,
          pageSize: raw?.pageSize || pageSize,
        };
      } catch (e) {
        toast.error("Failed to transform workflows response");
        return { items: [], totalCount: 0, pageNumber: currentPage, pageSize };
      }
    },
  });

  const loading = workflowsQuery.isLoading;
  const apiData = workflowsQuery.data?.data;

  useEffect(() => {
    const err = workflowsQuery.error;
    if (err) {
      const statusCode = (err as any)?.response?.status;
      if (statusCode === 401) {
        setError("Unauthorized – please login again.");
        toast.error("Session expired. Redirecting to login...");
        setTimeout(() => {
          if (typeof window !== "undefined") window.location.href = "/auth";
        }, 1200);
      } else {
        setError(err.message || "Failed to load workflows");
        toast.error(err.message || "Failed to load workflows");
      }
    } else if (apiData) {
      setError(null);
    }
  }, [workflowsQuery.error, apiData]);

  useEffect(() => {
    if (apiData) {
      setMutableData(apiData.items);
      setTotalCount(apiData.totalCount);
    }
  }, [apiData]);

  const filtered = mutableData;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );
  const goToPage = (p: number) =>
    setCurrentPage(Math.min(Math.max(1, p), totalPages));

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<WorkflowRecord["status"], number> = {
      completed: 0,
      "in-progress": 0,
      draft: 0,
      expired: 0,
      cancelled: 0,
      failed: 0,
    };
    filtered.forEach((wf) => {
      counts[wf.status] = (counts[wf.status] || 0) + 1;
    });
    return counts;
  }, [filtered]);

  // Statistics cards data
  const stats = useMemo(() => {
    return {
      total: filtered.length,
      completed: statusCounts.completed,
      inProgress: statusCounts["in-progress"],
      needsAttention: statusCounts.expired + statusCounts.cancelled,
    };
  }, [filtered, statusCounts]);

  const highlight = (text: string) => {
    if (!search) return text;
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <span>
        {text.slice(0, idx)}
        <span className="bg-gradient-to-r from-indigo-200 to-purple-200 dark:from-indigo-900/60 dark:to-purple-900/60 px-0.5 rounded">
          {text.slice(idx, idx + search.length)}
        </span>
        {text.slice(idx + search.length)}
      </span>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30 min-h-screen">
      {/* Premium Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 dark:from-indigo-700 dark:via-blue-700 dark:to-cyan-600 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_70%)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-white" />
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Workflows Overview
              </h1>
            </div>
            <p className="text-blue-100 text-sm max-w-xl">
              Manage your digital signature workflows with real-time tracking,
              advanced filtering, and comprehensive analytics
            </p>
          </div>
          <Button
            size="lg"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105"
            onClick={() => router.push("/prepare-document")}
          >
            <FileText className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Stats Cards with Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Workflows",
            value: stats.total,
            icon: FileText,
            gradient: "from-blue-500 to-cyan-500",
            bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40",
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: CheckCircle2,
            gradient: "from-emerald-500 to-teal-500",
            bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: TrendingUp,
            gradient: "from-indigo-500 to-purple-500",
            bgGradient: "from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40",
          },
          {
            label: "Needs Attention",
            value: stats.needsAttention,
            icon: AlertCircle,
            gradient: "from-amber-500 to-orange-500",
            bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40",
          },
        ].map((stat, idx) => (
          <Card
            key={idx}
            className={`relative overflow-hidden border-0 bg-gradient-to-br ${stat.bgGradient} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] backdrop-blur-sm`}
          >
            <div className="absolute inset-0 bg-gradient-to-br opacity-0 hover:opacity-10 transition-opacity duration-300 from-white to-transparent dark:from-white dark:to-transparent" />
            <div className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} shadow-md`}
                >
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight">
                {stat.value}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters & Search Section */}
      <Card className="border border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg">
        <div className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows, templates, or creators..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Sort & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 px-3 rounded-lg border border-border/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm text-sm transition-colors hover:border-indigo-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="createdDate">Sort: Created Date</option>
                <option value="updatedDate">Sort: Updated Date</option>
                <option value="workflowName">Sort: Name</option>
                <option value="status">Sort: Status</option>
                <option value="validUntil">Sort: Valid Until</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 hover:border-indigo-500 transition-colors"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortDir === "asc" ? "Ascending" : "Descending"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 hover:border-indigo-500 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                <ChevronDown
                  className={`h-4 w-4 ml-2 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>
          </div>

          {/* Status Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              {(
                Object.keys(statusConfig) as WorkflowRecord["status"][]
              ).map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                const active = statusSet.has(status);
                const count = statusCounts[status];
                return (
                  <button
                    key={status}
                    onClick={() =>
                      setStatusSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(status)) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                      active
                        ? `${config.borderColor} bg-gradient-to-br ${config.bgGradient} ${config.textColor} shadow-md scale-105`
                        : "border-border/50 bg-white/60 dark:bg-slate-800/60 text-muted-foreground hover:border-indigo-500"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{config.label}</span>
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
              {statusSet.size > 0 && (
                <button
                  onClick={() => setStatusSet(new Set())}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          {/* Active filter count */}
          {statusSet.size > 0 && (
            <div className="text-xs text-muted-foreground">
              Filtering by {statusSet.size} status
              {statusSet.size === 1 ? "" : "es"}
            </div>
          )}
        </div>
      </Card>

      {/* Workflows Grid */}
      <div className="flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl border border-border/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 border border-border/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
            <FileText className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Try adjusting your search or filters
            </p>
            <Button
              onClick={() => router.push("/prepare-document")}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg"
            >
              Create Your First Workflow
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((wf) => {
              const config = statusConfig[wf.status];
              return (
                <Card
                  key={wf.id}
                  className="group relative overflow-hidden border border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                  onClick={() => router.push(`/workflow/${wf.id}`)}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-blue-500/0 group-hover:from-indigo-500/5 group-hover:to-blue-500/5 transition-all duration-300 pointer-events-none" />

                  <div className="relative z-10 p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-1">
                          {highlight(wf.workflowName)}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono truncate flex items-center gap-1">
                          <span>{wf.id}</span>
                          <SigningModeBadge size="xs" hideLabelOnSmall isSequential={wf.isSequentialSigningEnabled} />
                        </p>
                      </div>
                      <GradientStatusBadge status={wf.status} />
                    </div>

                    {/* Template info */}
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Template
                        </p>
                        <p className="text-sm font-medium truncate">
                          {highlight(wf.templateName)}
                        </p>
                      </div>
                    </div>

                    {/* Creator */}
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Creator
                        </p>
                        <p className="text-sm font-medium truncate">
                          {highlight(wf.creator)}
                        </p>
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created
                        </p>
                        <p className="font-medium">{formatDateDDMMYYYY(wf.createdDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Updated
                        </p>
                        <p className="font-medium">{formatDateDDMMYYYY(wf.updatedDate)}</p>
                      </div>
                    </div>

                    {/* Days remaining badge */}
                    {wf.daysRemaining !== undefined && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                          wf.isExpired
                            ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/60"
                            : wf.daysRemaining <= 3
                            ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                            : "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDaysRemaining(wf.daysRemaining)} remaining
                      </div>
                    )}

                    {/* Action button */}
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md group-hover:shadow-lg transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/workflow/${wf.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > pageSize && (
        <Card className="border border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg">
          <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{" "}
              of <span className="font-medium text-foreground">{totalCount}</span>{" "}
              workflows
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 hover:border-indigo-500 disabled:opacity-50"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className={
                        currentPage === page
                          ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                          : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 hover:border-indigo-500"
                      }
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-border/50 hover:border-indigo-500 disabled:opacity-50"
              >
                Next
              </Button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 px-3 rounded-lg border border-border/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm text-sm transition-colors hover:border-indigo-500 focus:border-indigo-500"
              >
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
              </select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default WorkflowsOverviewPage;

