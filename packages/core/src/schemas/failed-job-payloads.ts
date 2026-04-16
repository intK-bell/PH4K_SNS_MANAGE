import type { CandidateStatus, PostStatus } from "../constants/statuses.js";

export interface FailedLinePushJob {
  jobType: "line_push";
  candidateId: string;
  ideaId: string;
  candidateStatus: CandidateStatus;
  lineDeliveryStatus: "failed";
  lineDeliveryAttempts: number;
  lineLastAttemptAt: string | null;
  lineNextRetryAt: string | null;
  lineLastError: string | null;
  updatedAt: string;
}

export interface FailedSpreadsheetSyncJob {
  jobType: "spreadsheet_sync";
  postId: string;
  candidateId: string;
  ideaId: string;
  postStatus: PostStatus;
  spreadsheetSyncStatus: "failed";
  spreadsheetSyncAttempts: number;
  spreadsheetLastSyncedAt: string | null;
  spreadsheetNextRetryAt: string | null;
  spreadsheetSyncError: string | null;
  updatedAt: string;
}

export interface FailedJobsSummary {
  total: number;
  linePush: number;
  spreadsheetSync: number;
}

export interface FailedJobsResponse {
  summary: FailedJobsSummary;
  linePushJobs: FailedLinePushJob[];
  spreadsheetSyncJobs: FailedSpreadsheetSyncJob[];
}
