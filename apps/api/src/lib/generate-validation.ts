import type { GenerateCandidatesInput } from "@ph4k/core";
import { HttpError } from "./http.js";

const allowedTypes: GenerateCandidatesInput["type"][] = [
  "awareness",
  "overtime",
  "before_after",
  "double_question",
  "light_achievement",
  "cta",
  "constraint",
  "viral",
];

export const validateGenerateCandidatesRequest = (
  input: unknown,
  ideaId: string,
): GenerateCandidatesInput => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const type = candidate.type;
  const count = candidate.count === undefined ? 3 : candidate.count;

  if (typeof type !== "string" || !allowedTypes.includes(type as GenerateCandidatesInput["type"])) {
    throw new HttpError(400, "invalid post type");
  }

  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10) {
    throw new HttpError(400, "count must be an integer between 1 and 10");
  }

  return {
    ideaId,
    type: type as GenerateCandidatesInput["type"],
    count,
  };
};
