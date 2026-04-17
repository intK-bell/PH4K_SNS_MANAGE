export const IDEA_STATUSES = ["active", "archived"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const CANDIDATE_STATUSES = [
  "generated",
  "queued_for_line",
  "sent_to_line",
  "confirming",
  "pending",
  "posted",
  "held",
  "discarded",
  "regenerating",
  "closed",
  "error",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const POST_STATUSES = ["pending", "posted", "metric_pending", "error"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
