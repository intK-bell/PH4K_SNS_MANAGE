import { HttpError } from "./http.js";

export const parseJsonBody = <T>(body: string | null): T => {
  if (!body) {
    throw new HttpError(400, "request body is required");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, "request body must be valid json");
  }
};

export const getRequiredPathParam = (
  pathParameters: Record<string, string> | null,
  key: string,
  path?: string,
): string => {
  const fromPathParameters = pathParameters?.[key];
  if (fromPathParameters) {
    return fromPathParameters;
  }

  const resourceByKey: Record<string, string> = {
    ideaId: "ideas",
    candidateId: "candidates",
    postId: "posts",
  };

  const resource = resourceByKey[key];
  const match =
    resource && path
      ? path.match(new RegExp(`^/${resource}/([^/]+)(?:/.*)?$`))
      : null;
  const value = match?.[1];
  if (!value) {
    throw new HttpError(400, `path parameter '${key}' is required`);
  }
  return value;
};
