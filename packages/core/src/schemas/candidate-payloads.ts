import type { CandidateStatus } from "../constants/statuses.js";
import type { PostType } from "../constants/post-types.js";

export interface UpdateCandidateInput {
  hook?: string;
  body?: string;
  selected?: boolean;
  status?: CandidateStatus;
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
