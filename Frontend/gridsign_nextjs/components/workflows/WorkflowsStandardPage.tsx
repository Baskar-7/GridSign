"use client";

import React, { useEffect, useMemo, useState } from "react";
import SigningModeBadge from './SigningModeBadge';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import {
  Search,
  Eye,
  Filter,
  FileText,
  User,
  Calendar,
  ChevronDown,
  Download,
} from "lucide-react";

import {
  WorkflowSummaryRaw,
  mapWorkflowSummaryRawToUI,
  WorkflowRecordUI,
  uiStatusToBackend,
} from "@/types/workflow";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";

type WorkflowRecord = WorkflowRecordUI;

// Minimal status colors - professional and clean
const statusConfig: Record<
  WorkflowRecord["status"],
  {
    label: string;
    color: string;
  }
> = {
  completed: { label: "Completed", color: "text-emerald-700 dark:text-emerald-400" },
  "in-progress": { label: "In Progress", color: "text-blue-700 dark:text-blue-400" },
  expired: { label: "Expired", color: "text-slate-700 dark:text-slate-400" },
  // Standardize expired to gray across views
  // was amber; switching to slate/neutral gray
  // Note: keeping other statuses unchanged
  //
  // Replace mapping for expired
  // (This line intentionally overridden below)
  cancelled: { label: "Cancelled", color: "text-slate-600 dark:text-slate-400" },
  draft: { label: "Draft", color: "text-slate-500 dark:text-slate-400" },
  failed: { label: "Failed", color: "text-red-700 dark:text-red-400" },
};

const StatusBadge: React.FC<{ status: WorkflowRecord["status"] }> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Replaced local date helper with shared formatDateDDMMYYYY

const WorkflowsStandardPage: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusSet, setStatusSet] = useState<Set<WorkflowRecord["status"]>>(new Set());
  const [sortBy, setSortBy] = useState<string>("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mutableData, setMutableData] = useState<WorkflowRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:3000";
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const apiRoot = /\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`;

  const backendStatusesArray = useMemo(() => {
    if (statusSet.size === 0) return [] as number[];
    return Array.from(statusSet).map((s) => uiStatusToBackend(s));
  }, [statusSet]);

  const backendSortKey = (field: string): string => {
    const mapping: Record<string, string> = {
      workflowName: "workflowname",
      validUntil: "validuntil",
      status: "status",
      creator: "workflowowner",
      createdDate: "createdon",
      updatedDate: "lastupdateddate",
    };
    return mapping[field] || "createdon";
  };

  const workflowsQuery = useApiQuery<{
    items: WorkflowRecord[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
  }>({
    queryKey: ["workflows", currentPage, pageSize, search, sortBy, sortDir, backendStatusesArray.sort().join("-")],
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
    enabled: typeof window !== "undefined" && !!localStorage.getItem("token"),
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
        toast.error("Failed to load workflows");
        return { items: [], totalCount: 0, pageNumber: currentPage, pageSize };
      }
    },
  });

  const loading = workflowsQuery.isLoading;
  const apiData = workflowsQuery.data?.data;

  useEffect(() => {
    if (apiData) {
      setMutableData(apiData.items);
      setTotalCount(apiData.totalCount);
    }
  }, [apiData]);

  const filtered = mutableData;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

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

  const exportData = () => {
    const csv = filtered.map(wf => ({
      Name: wf.workflowName,
      Template: wf.templateName,
      Creator: wf.creator,
      Status: wf.status,
  Created: formatDateDDMMYYYY(wf.createdDate),
  Updated: formatDateDDMMYYYY(wf.updatedDate),
    }));
    
    const headers = Object.keys(csv[0] || {});
    const csvContent = [
      headers.join(','),
      ...csv.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflows-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported workflows to CSV');
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      {/* Clean Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your document workflows
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/prepare-document")}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          New Workflow
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: filtered.length },
          { label: "Completed", value: statusCounts.completed },
          { label: "In Progress", value: statusCounts["in-progress"] },
          { label: "Draft", value: statusCounts.draft },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 border border-border">
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="text-2xl font-semibold mt-1">{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border border-border">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSortMenu((s) => !s)}
                  className="gap-2"
                  aria-haspopup="menu"
                  aria-expanded={showSortMenu}
                  title="Sort options"
                >
                  <span className="text-sm">Sort:</span>
                  <span className="font-medium">
                    {sortBy === 'createdDate' ? 'Created Date'
                      : sortBy === 'updatedDate' ? 'Updated Date'
                      : sortBy === 'workflowName' ? 'Name'
                      : 'Status'}
                  </span>
                  <span className="text-xs opacity-70">({sortDir === 'asc' ? 'Asc' : 'Desc'})</span>
                </Button>
                {showSortMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-40 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-30"
                  >
                    <div className="p-1 text-[10px]">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Sort Field</div>
                      {[
                        { key: 'createdDate', label: 'Created Date' },
                        { key: 'updatedDate', label: 'Updated Date' },
                        { key: 'workflowName', label: 'Name' },
                        { key: 'status', label: 'Status' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => { setSortBy(opt.key); setShowSortMenu(false); setCurrentPage(1); }}
                          className={
                            'w-full text-left px-2 py-0.5 rounded-md hover:bg-muted/40 text-[10px] ' +
                            (sortBy === opt.key ? 'bg-muted/30 font-medium' : '')
                          }
                          role="menuitem"
                        >
                          {opt.label}
                        </button>
                      ))}
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Direction</div>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button
                          onClick={() => { setSortDir('asc'); setShowSortMenu(false); }}
                          className={'px-2 py-0.5 rounded-md border text-[10px] ' + (sortDir === 'asc' ? 'bg-muted/60 font-semibold shadow-sm' : 'bg-background')}
                          role="menuitem"
                          aria-pressed={sortDir === 'asc'}
                        >Asc</button>
                        <button
                          onClick={() => { setSortDir('desc'); setShowSortMenu(false); }}
                          className={'px-2 py-0.5 rounded-md border text-[10px] ' + (sortDir === 'desc' ? 'bg-muted/60 font-semibold shadow-sm' : 'bg-background')}
                          role="menuitem"
                          aria-pressed={sortDir === 'desc'}
                        >Desc</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? "Hide" : "Filters"}
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </Button>
              {filtered.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportData} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(statusConfig) as WorkflowRecord["status"][]).map((status) => {
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
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        active
                          ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          : "bg-background border-border hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      {statusConfig[status].label} ({count})
                    </button>
                  );
                })}
                {statusSet.size > 0 && (
                  <button
                    onClick={() => setStatusSet(new Set())}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-slate-50 dark:hover:bg-slate-900 text-muted-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Data Table */}
      <Card className="border border-border flex-1 flex flex-col">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading workflows...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search || statusSet.size > 0
                ? "Try adjusting your search or filters"
                : "Create your first workflow to get started"}
            </p>
            <Button onClick={() => router.push("/prepare-document")}>
              Create Workflow
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full">
                <thead className="border-b border-border bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Workflow Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Template
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Creator
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((wf) => (
                    <tr
                      key={wf.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                      onClick={() => router.push(`/workflow/${wf.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{wf.workflowName}</div>
                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          {wf.id}
                          <SigningModeBadge className="ml-0" size="xs" hideLabelOnSmall isSequential={wf.isSequentialSigningEnabled} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {wf.templateName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {wf.creator}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={wf.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateDDMMYYYY(wf.createdDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateDDMMYYYY(wf.updatedDate)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/workflow/${wf.id}`);
                          }}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Pagination */}
            <div className="p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} workflows
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </Button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default WorkflowsStandardPage;

