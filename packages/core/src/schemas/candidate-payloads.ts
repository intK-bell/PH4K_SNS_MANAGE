import type { CandidateStatus } from "../constants/statuses.js";
import type { PostType } from "../constants/post-types.js";

export interface UpdateCandidateInput {
  deliveryBatchId?: string;
  hook?: string;
  body?: string;
  selected?: boolean;
  status?: CandidateStatus;
  trackingShortId?: string | null;
  lineDeliveryStatus?: "not_sent" | "sent" | "failed";
  lineDeliveryAttempts?: number;
  lineLastAttemptAt?: string | null;
  lineNextRetryAt?: string | null;
  lineLastError?: string | null;
}

export interface GeneratedCandidateDraft {
  type: PostType;
  hook: string;
  body: string;
  promptVersion: string;
}
