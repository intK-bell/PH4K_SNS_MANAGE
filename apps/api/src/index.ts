import type { ApiGatewayEvent, ApiResponse } from "./lib/api-types.js";
import { listCandidates } from "./handlers/candidates/list-candidates.js";
import { retryLinePush } from "./handlers/candidates/retry-line-push.js";
import { updateCandidate } from "./handlers/candidates/update-candidate.js";
import { createIdea } from "./handlers/ideas/create-idea.js";
import { getIdea } from "./handlers/ideas/get-idea.js";
import { listIdeas } from "./handlers/ideas/list-ideas.js";
import { startGenerateCandidates } from "./handlers/ideas/start-generate-candidates.js";
import { updateIdea } from "./handlers/ideas/update-idea.js";
import { listFailedJobs } from "./handlers/jobs/list-failed-jobs.js";
import { listPosts } from "./handlers/posts/list-posts.js";
import { retrySheetSync } from "./handlers/posts/retry-sheet-sync.js";
import { handleLineWebhook } from "./handlers/webhooks/handle-line-webhook.js";
import { HttpError, json } from "./lib/http.js";

const routes = [
  {
    method: "GET",
    pattern: /^\/ideas$/,
    handler: async () => listIdeas(),
  },
  {
    method: "POST",
    pattern: /^\/ideas$/,
    handler: async (event: ApiGatewayEvent) => createIdea(event.body),
  },
  {
    method: "GET",
    pattern: /^\/ideas\/[^/]+$/,
    handler: async (event: ApiGatewayEvent) => getIdea(event),
  },
  {
    method: "PUT",
    pattern: /^\/ideas\/[^/]+$/,
    handler: async (event: ApiGatewayEvent) => updateIdea(event),
  },
  {
    method: "POST",
    pattern: /^\/ideas\/[^/]+\/generate$/,
    handler: async (event: ApiGatewayEvent) => startGenerateCandidates(event),
  },
  {
    method: "GET",
    pattern: /^\/jobs\/failed$/,
    handler: async () => listFailedJobs(),
  },
  {
    method: "GET",
    pattern: /^\/candidates$/,
    handler: async () => listCandidates(),
  },
  {
    method: "PUT",
    pattern: /^\/candidates\/[^/]+$/,
    handler: async (event: ApiGatewayEvent) => updateCandidate(event),
  },
  {
    method: "POST",
    pattern: /^\/candidates\/[^/]+\/retry-line$/,
    handler: async (event: ApiGatewayEvent) => retryLinePush(event),
  },
  {
    method: "GET",
    pattern: /^\/posts$/,
    handler: async () => listPosts(),
  },
  {
    method: "POST",
    pattern: /^\/posts\/[^/]+\/retry-sheet$/,
    handler: async (event: ApiGatewayEvent) => retrySheetSync(event),
  },
  {
    method: "POST",
    pattern: /^\/webhooks\/line$/,
    handler: async (event: ApiGatewayEvent) => handleLineWebhook(event),
  },
];

export const handler = async (event: ApiGatewayEvent): Promise<ApiResponse> => {
  try {
    const route = routes.find(
      (entry) => entry.method === event.httpMethod && entry.pattern.test(event.path),
    );

    if (!route) {
      return json(404, { message: "route not found" });
    }

    return await route.handler(event);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.statusCode, { message: error.message });
    }

    console.error("unhandled error", error);
    return json(500, { message: "internal server error" });
  }
};
