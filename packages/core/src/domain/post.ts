import type { PostStatus } from "../constants/statuses.js";

export interface Post {
  postId: string;
  candidateId: string;
  ideaId: string;
  snsType: "x";
  externalPostId: string | null;
  postUrl: string | null;
  postedAt: string | null;
  status: PostStatus;
  latestImpressions: number | null;
  latestLikes: number | null;
  latestReplies: number | null;
  latestReposts: number | null;
  latestBookmarks: number | null;
  spreadsheetSyncStatus: "pending" | "synced" | "failed";
  spreadsheetSyncAttempts: number;
  spreadsheetLastSyncedAt: string | null;
  spreadsheetNextRetryAt: string | null;
  spreadsheetSyncError: string | null;
  updatedAt: string;
}
