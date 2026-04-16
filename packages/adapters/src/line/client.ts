import { createHmac, timingSafeEqual } from "node:crypto";
import type { Candidate, LineCandidateAction, LineWebhookActionPayload } from "@ph4k/core";

const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/push";

const encodeActionData = (payload: LineWebhookActionPayload): string =>
  JSON.stringify(payload);

export const parseLineActionData = (rawData: string): LineWebhookActionPayload => {
  const parsed = JSON.parse(rawData) as Partial<LineWebhookActionPayload>;
  if (
    !parsed ||
    typeof parsed.candidateId !== "string" ||
    typeof parsed.action !== "string"
  ) {
    throw new Error("invalid line action payload");
  }

  const allowed: LineCandidateAction[] = ["post", "hold", "discard", "regenerate"];
  if (!allowed.includes(parsed.action as LineCandidateAction)) {
    throw new Error("unsupported line action");
  }

  return {
    action: parsed.action as LineCandidateAction,
    candidateId: parsed.candidateId,
  };
};

export class LineMessagingClient {
  constructor(
    private readonly channelAccessToken: string,
    private readonly channelSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  verifySignature(rawBody: string, signature: string): boolean {
    const digest = createHmac("sha256", this.channelSecret).update(rawBody).digest("base64");
    const left = Buffer.from(digest);
    const right = Buffer.from(signature);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  buildCandidateMessage(candidate: Candidate) {
    return {
      type: "text",
      text: [
        `候補ID: ${candidate.candidateId}`,
        `型: ${candidate.type}`,
        `フック: ${candidate.hook}`,
        "",
        candidate.body,
        "",
        "操作: post / hold / discard / regenerate",
      ].join("\n"),
      quickReply: {
        items: (["post", "hold", "discard", "regenerate"] as LineCandidateAction[]).map(
          (action) => ({
            type: "action",
            action: {
              type: "postback",
              label: action,
              data: encodeActionData({
                action,
                candidateId: candidate.candidateId,
              }),
              displayText: `${action}: ${candidate.candidateId}`,
            },
          }),
        ),
      },
    };
  }

  async pushCandidates(userId: string, candidates: Candidate[]): Promise<void> {
    if (!this.channelAccessToken || !userId || candidates.length === 0) {
      return;
    }

    const messages = candidates.map((candidate) => this.buildCandidateMessage(candidate));
    const response = await this.fetchImpl(LINE_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`line push failed: ${response.status}`);
    }
  }
}
