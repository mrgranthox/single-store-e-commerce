import { apiRequest, ApiError } from "@/lib/api/http";

export type JobRunRow = {
  id: string;
  jobName: string;
  jobId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: unknown;
  metadata: unknown;
  createdAt: string;
};

export type ListJobRunsQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  jobName?: string;
  startedAfter?: string;
  startedBefore?: string;
};

const jobRunsQs = (query: ListJobRunsQuery) => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.jobName?.trim()) {
    params.set("jobName", query.jobName.trim());
  }
  if (query.startedAfter?.trim()) {
    params.set("startedAfter", query.startedAfter.trim());
  }
  if (query.startedBefore?.trim()) {
    params.set("startedBefore", query.startedBefore.trim());
  }
  return `?${params.toString()}`;
};

export type JobRunsListResponse = {
  success: true;
  data: { items: JobRunRow[] };
  meta: { page: number; pageSize: number; total: number };
};

export const listAdminJobRuns = async (
  accessToken: string,
  query: ListJobRunsQuery = {}
): Promise<JobRunsListResponse> =>
  apiRequest<JobRunsListResponse>({
    path: `/api/admin/jobs${jobRunsQs(query)}`,
    accessToken
  });

export type JobRunDetailResponse = {
  success: true;
  data: JobRunRow;
};

export const getAdminJobRun = async (accessToken: string, jobRunId: string): Promise<JobRunDetailResponse> =>
  apiRequest<JobRunDetailResponse>({
    path: `/api/admin/jobs/${encodeURIComponent(jobRunId)}`,
    accessToken
  });

export const retryAdminJobRun = async (
  accessToken: string,
  jobRunId: string,
  body: Record<string, unknown> = {}
): Promise<{ success: true; data: unknown }> =>
  apiRequest({
    method: "POST",
    path: `/api/admin/jobs/${encodeURIComponent(jobRunId)}/retry`,
    accessToken,
    body
  });

export { ApiError };
