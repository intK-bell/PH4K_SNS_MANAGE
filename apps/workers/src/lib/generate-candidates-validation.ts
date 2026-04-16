import type { GenerateCandidatesInput } from "@ph4k/core";

export const validateGenerateCandidatesInput = (input: unknown): GenerateCandidatesInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const count = typeof candidate.count === "number" ? candidate.count : 3;

  if (typeof candidate.ideaId !== "string" || candidate.ideaId.trim() === "") {
    throw new Error("ideaId is required");
  }

  const type = candidate.type;
  const allowed = [
    "awareness",
    "overtime",
    "before_after",
    "double_question",
    "light_achievement",
    "cta",
    "constraint",
    "viral",
  ];

  if (!allowed.includes(String(type))) {
    throw new Error("invalid post type");
  }

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error("count must be an integer between 1 and 10");
  }

  return {
    ideaId: candidate.ideaId.trim(),
    type: type as GenerateCandidatesInput["type"],
    count,
  };
};
