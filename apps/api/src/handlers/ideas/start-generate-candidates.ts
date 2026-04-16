import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { workflowService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { validateGenerateCandidatesRequest } from "../../lib/generate-validation.js";
import { getRequiredPathParam, parseJsonBody } from "../../lib/request.js";

export const startGenerateCandidates = async (event: ApiGatewayEvent) => {
  const ideaId = getRequiredPathParam(event.pathParameters, "ideaId", event.path);
  const payload = validateGenerateCandidatesRequest(parseJsonBody(event.body), ideaId);
  const execution = await workflowService.startCandidateDeliveryExecution(payload);

  return json(202, {
    ideaId,
    ...execution,
  });
};
