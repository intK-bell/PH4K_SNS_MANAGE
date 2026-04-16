import type { SyncToSpreadsheetInput } from "@ph4k/core";

export const validateSyncToSpreadsheetInput = (input: unknown): SyncToSpreadsheetInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const postId = (input as { postId?: unknown }).postId;
  if (typeof postId !== "string" || postId.trim() === "") {
    throw new Error("postId is required");
  }

  return {
    postId: postId.trim(),
  };
};
