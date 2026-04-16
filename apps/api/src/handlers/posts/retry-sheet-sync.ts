import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { retryService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { getRequiredPathParam } from "../../lib/request.js";

export const retrySheetSync = async (event: ApiGatewayEvent) => {
  const postId = getRequiredPathParam(event.pathParameters, "postId", event.path);
  const result = await retryService.retrySpreadsheetSync(postId);
  return json(202, {
    postId,
    ...result,
  });
};
