import type { PostType } from "../constants/post-types.js";

export type LineCandidateAction =
  | "select_candidate"
  | "confirm_post"
  | "cancel_post"
  | "regenerate_batch"
  | "skip_batch";

export interface PushCandidatesToLineInput {
  candidateIds: string[];
}

export interface LineWebhookActionPayload {
  action: LineCandidateAction;
  candidateId?: string;
  deliveryBatchId?: string;
  ideaId?: string;
  type?: PostType;
  count?: number;
}

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  postback?: {
    data?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
}

export interface LineWebhookRequest {
  events: LineWebhookEvent[];
}
