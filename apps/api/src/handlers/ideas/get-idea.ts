import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { ideaService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { getRequiredPathParam } from "../../lib/request.js";

export const getIdea = async (event: ApiGatewayEvent) => {
  const ideaId = getRequiredPathParam(event.pathParameters, "ideaId", event.path);
  const idea = await ideaService.getIdea(ideaId);
  return json(200, idea);
};
