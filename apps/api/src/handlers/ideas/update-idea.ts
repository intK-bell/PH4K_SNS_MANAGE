import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { ideaService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { validateUpdateIdeaInput } from "../../lib/idea-validation.js";
import { getRequiredPathParam, parseJsonBody } from "../../lib/request.js";

export const updateIdea = async (event: ApiGatewayEvent) => {
  const ideaId = getRequiredPathParam(event.pathParameters, "ideaId", event.path);
  const payload = validateUpdateIdeaInput(parseJsonBody(event.body));
  const updated = await ideaService.updateIdea(ideaId, payload);
  return json(200, updated);
};
