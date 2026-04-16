import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { candidateService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { validateUpdateCandidateInput } from "../../lib/candidate-validation.js";
import { getRequiredPathParam, parseJsonBody } from "../../lib/request.js";

export const updateCandidate = async (event: ApiGatewayEvent) => {
  const candidateId = getRequiredPathParam(event.pathParameters, "candidateId", event.path);
  const payload = validateUpdateCandidateInput(parseJsonBody(event.body));
  const updated = await candidateService.updateCandidate(candidateId, payload);
  return json(200, updated);
};
