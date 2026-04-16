import type { FetchPostMetricsInput } from "@ph4k/core";

export const validateFetchPostMetricsInput = (input: unknown): FetchPostMetricsInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const postId = (input as { postId?: unknown }).postId;
  const offsetHours = (input as { offsetHours?: unknown }).offsetHours;

  if (typeof postId !== "string" || postId.trim() === "") {
    throw new Error("postId is required");
  }

  if (offsetHours !== undefined && typeof offsetHours !== "number") {
    throw new Error("offsetHours must be a number");
  }

  if (offsetHours === undefined) {
    return {
      postId: postId.trim(),
    };
  }

  return {
    postId: postId.trim(),
    offsetHours,
  };
};
