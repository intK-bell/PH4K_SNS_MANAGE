import type { CreateIdeaInput, UpdateIdeaInput } from "@ph4k/core";
import { HttpError } from "./http.js";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const validateCreateIdeaInput = (input: unknown): CreateIdeaInput => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.title !== "string" || candidate.title.trim() === "") {
    throw new HttpError(400, "title is required");
  }
  if (typeof candidate.problem !== "string" || candidate.problem.trim() === "") {
    throw new HttpError(400, "problem is required");
  }
  if (typeof candidate.detail !== "string" || candidate.detail.trim() === "") {
    throw new HttpError(400, "detail is required");
  }
  if (typeof candidate.priority !== "number" || Number.isNaN(candidate.priority)) {
    throw new HttpError(400, "priority must be a number");
  }
  if (!isStringArray(candidate.tags)) {
    throw new HttpError(400, "tags must be an array of strings");
  }

  return {
    title: candidate.title.trim(),
    problem: candidate.problem.trim(),
    detail: candidate.detail.trim(),
    priority: candidate.priority,
    tags: candidate.tags,
  };
};

export const validateUpdateIdeaInput = (input: unknown): UpdateIdeaInput => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const output: UpdateIdeaInput = {};

  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string" || candidate.title.trim() === "") {
      throw new HttpError(400, "title must be a non-empty string");
    }
    output.title = candidate.title.trim();
  }

  if (candidate.problem !== undefined) {
    if (typeof candidate.problem !== "string" || candidate.problem.trim() === "") {
      throw new HttpError(400, "problem must be a non-empty string");
    }
    output.problem = candidate.problem.trim();
  }

  if (candidate.detail !== undefined) {
    if (typeof candidate.detail !== "string" || candidate.detail.trim() === "") {
      throw new HttpError(400, "detail must be a non-empty string");
    }
    output.detail = candidate.detail.trim();
  }

  if (candidate.priority !== undefined) {
    if (typeof candidate.priority !== "number" || Number.isNaN(candidate.priority)) {
      throw new HttpError(400, "priority must be a number");
    }
    output.priority = candidate.priority;
  }

  if (candidate.tags !== undefined) {
    if (!isStringArray(candidate.tags)) {
      throw new HttpError(400, "tags must be an array of strings");
    }
    output.tags = candidate.tags;
  }

  if (candidate.status !== undefined) {
    if (candidate.status !== "active" && candidate.status !== "archived") {
      throw new HttpError(400, "status must be 'active' or 'archived'");
    }
    output.status = candidate.status;
  }

  return output;
};
