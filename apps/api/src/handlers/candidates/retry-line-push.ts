import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { retryService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { getRequiredPathParam } from "../../lib/request.js";

export const retryLinePush = async (event: ApiGatewayEvent) => {
  const candidateId = getRequiredPathParam(event.pathParameters, "candidateId", event.path);
  const result = await retryService.retryLinePush(candidateId);
  return json(202, {
    candidateId,
    ...result,
  });
};
