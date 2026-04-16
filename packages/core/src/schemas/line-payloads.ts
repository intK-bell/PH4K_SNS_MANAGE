export type LineCandidateAction = "post" | "hold" | "discard" | "regenerate";

export interface PushCandidatesToLineInput {
  candidateIds: string[];
}

export interface LineWebhookActionPayload {
  action: LineCandidateAction;
  candidateId: string;
}

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  postback?: {
    data?: string;
  };
}

export interface LineWebhookRequest {
  events: LineWebhookEvent[];
}
