import { loadEnv } from "@ph4k/config";
import {
  createDynamoDocumentClient,
  DynamoClickTrackingRepository,
} from "@ph4k/infra";
import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { HttpError, redirect } from "../../lib/http.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const clickTrackingRepository = new DynamoClickTrackingRepository(client, env.clicksTableName);

const getShortId = (event: ApiGatewayEvent): string => {
  const direct = event.pathParameters?.shortId;
  if (direct) {
    return direct;
  }

  const match = event.path.match(/^\/r\/([^/]+)$/);
  if (!match?.[1]) {
    throw new HttpError(400, "path parameter 'shortId' is required");
  }

  return match[1];
};

const getHeader = (event: ApiGatewayEvent, key: string): string | null => {
  const headers = event.headers ?? {};
  const found = Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === key);
  return found?.[1] ?? null;
};

export const redirectClick = async (event: ApiGatewayEvent) => {
  const shortId = getShortId(event);
  const link = await clickTrackingRepository.getLinkByShortId(shortId);

  if (!link) {
    throw new HttpError(404, "click link not found");
  }

  const ipAddressHeader = getHeader(event, "x-forwarded-for");
  await clickTrackingRepository.createClickEvent({
    shortId,
    postId: link.postId,
    clickedAt: new Date().toISOString(),
    userAgent: getHeader(event, "user-agent"),
    referer: getHeader(event, "referer"),
    ipAddress: ipAddressHeader?.split(",")[0]?.trim() || null,
  });

  return redirect(link.landingUrl);
};
