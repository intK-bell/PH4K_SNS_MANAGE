import type { GenerateCandidatesInput } from "@ph4k/core";

export const validateGenerateCandidatesInput = (input: unknown): GenerateCandidatesInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const count = typeof candidate.count === "number" ? candidate.count : 5;
  const language = candidate.language === undefined ? "ja" : candidate.language;

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
    "current_affairs",
    "viral",
  ];
  const allowedLanguages = ["ja", "zh", "en", "vi"];

  if (!allowed.includes(String(type))) {
    throw new Error("invalid post type");
  }

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error("count must be an integer between 1 and 10");
  }

  if (!allowedLanguages.includes(String(language))) {
    throw new Error("invalid language");
  }

  return {
    ideaId: candidate.ideaId.trim(),
    type: type as GenerateCandidatesInput["type"],
    count,
    language: language as NonNullable<GenerateCandidatesInput["language"]>,
  };
};
