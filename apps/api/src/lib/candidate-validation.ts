import type { UpdateCandidateInput } from "@ph4k/core";
import { HttpError } from "./http.js";

const candidateStatuses = [
  "generated",
  "queued_for_line",
  "sent_to_line",
  "pending",
  "posted",
  "held",
  "discarded",
  "regenerating",
  "error",
] as const;

export const validateUpdateCandidateInput = (input: unknown): UpdateCandidateInput => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const output: UpdateCandidateInput = {};

  if (candidate.hook !== undefined) {
    if (typeof candidate.hook !== "string" || candidate.hook.trim() === "") {
      throw new HttpError(400, "hook must be a non-empty string");
    }
    output.hook = candidate.hook.trim();
  }

  if (candidate.body !== undefined) {
    if (typeof candidate.body !== "string" || candidate.body.trim() === "") {
      throw new HttpError(400, "body must be a non-empty string");
    }
    output.body = candidate.body.trim();
  }

  if (candidate.selected !== undefined) {
    if (typeof candidate.selected !== "boolean") {
      throw new HttpError(400, "selected must be a boolean");
    }
    output.selected = candidate.selected;
  }

  if (candidate.status !== undefined) {
    if (
      typeof candidate.status !== "string" ||
      !candidateStatuses.includes(
        candidate.status as (typeof candidateStatuses)[number],
      )
    ) {
      throw new HttpError(400, "invalid candidate status");
    }
    output.status = candidate.status as (typeof candidateStatuses)[number];
  }

  if (candidate.lineDeliveryStatus !== undefined) {
    if (
      candidate.lineDeliveryStatus !== "not_sent" &&
      candidate.lineDeliveryStatus !== "sent" &&
      candidate.lineDeliveryStatus !== "failed"
    ) {
      throw new HttpError(400, "invalid lineDeliveryStatus");
    }
    output.lineDeliveryStatus = candidate.lineDeliveryStatus;
  }

  return output;
};
