import type { PushCandidatesToLineInput } from "@ph4k/core";

export const validatePushCandidatesToLineInput = (input: unknown): PushCandidatesToLineInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const candidateIds = (input as { candidateIds?: unknown }).candidateIds;
  if (!Array.isArray(candidateIds) || candidateIds.some((id) => typeof id !== "string")) {
    throw new Error("candidateIds must be an array of strings");
  }

  return {
    candidateIds,
  };
};
