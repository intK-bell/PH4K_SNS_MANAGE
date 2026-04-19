import type { PostType } from "../constants/post-types.js";
import type { CandidateStatus } from "../constants/statuses.js";

export interface Candidate {
  candidateId: string;
  ideaId: string;
  deliveryBatchId: string;
  type: PostType;
  hook: string;
  body: string;
  selected: boolean;
  status: CandidateStatus;
  trackingShortId: string | null;
  promptVersion: string;
  lineDeliveryStatus: "not_sent" | "sent" | "failed";
  lineDeliveryAttempts: number;
  lineLastAttemptAt: string | null;
  lineNextRetryAt: string | null;
  lineLastError: string | null;
  createdAt: string;
  updatedAt: string;
}
