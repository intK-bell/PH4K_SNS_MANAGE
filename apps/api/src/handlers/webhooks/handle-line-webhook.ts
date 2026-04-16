import type { LineWebhookRequest } from "@ph4k/core";
import type { ApiGatewayEvent } from "../../lib/api-types.js";
import { webhookService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { parseJsonBody } from "../../lib/request.js";

const getHeader = (
  headers: Record<string, string | undefined> | null | undefined,
  key: string,
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const found = Object.entries(headers).find(
    ([headerKey]) => headerKey.toLowerCase() === key.toLowerCase(),
  );
  return found?.[1];
};

export const handleLineWebhook = async (event: ApiGatewayEvent) => {
  const rawBody = event.body ?? "";
  try {
    const previewPayload = JSON.parse(rawBody) as {
      events?: Array<{ type?: string; source?: unknown }>;
    };
    console.log(
      "line webhook sources preview",
      JSON.stringify(
        (previewPayload.events ?? []).map((item) => ({
          type: item.type ?? null,
          source: item.source ?? null,
        })),
      ),
    );
  } catch {
    console.log("line webhook sources preview", "failed_to_parse");
  }
  webhookService.verifySignature(
    rawBody,
    getHeader(event.headers, "x-line-signature"),
  );
  const payload = parseJsonBody<LineWebhookRequest>(rawBody);
  const results = await webhookService.handleWebhook(payload);
  return json(200, { ok: true, results });
};
