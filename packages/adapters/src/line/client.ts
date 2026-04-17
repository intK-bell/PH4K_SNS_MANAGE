import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Candidate,
  LineCandidateAction,
  LineWebhookActionPayload,
  PostType,
} from "@ph4k/core";

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const MAX_CANDIDATE_COLUMNS_PER_CAROUSEL = 9;
const TYPE_LABELS: Record<PostType, string> = {
  awareness: "気づき喚起型",
  overtime: "残業訴求型",
  before_after: "Before/After型",
  double_question: "問いかけ型",
  light_achievement: "共感型",
  cta: "CTA型",
  constraint: "制約型",
  viral: "拡散特化型",
};

type LineMessage = Record<string, unknown>;

const encodeActionData = (payload: LineWebhookActionPayload): string =>
  JSON.stringify(payload);

const truncate = (value: string, length: number): string => {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, Math.max(0, length - 1))}…`;
};

const buildCandidateSummary = (candidate: Candidate): string =>
  truncate(
    [candidate.hook, candidate.body].filter(Boolean).join("\n"),
    60,
  );

const buildColumnTitle = (candidate: Candidate): string =>
  truncate(candidate.hook || `${candidate.type}案`, 40);

const isCandidateAction = (action: string): action is LineCandidateAction =>
  [
    "select_candidate",
    "confirm_post",
    "cancel_post",
    "regenerate_batch",
    "skip_batch",
  ].includes(action);

const assertString = (
  value: unknown,
  fieldName: string,
): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
};

const assertCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("count must be an integer between 1 and 10");
  }

  return value;
};

const assertPostType = (value: unknown): PostType => {
  const allowed: PostType[] = [
    "awareness",
    "overtime",
    "before_after",
    "double_question",
    "light_achievement",
    "cta",
    "constraint",
    "viral",
  ];

  if (typeof value !== "string" || !allowed.includes(value as PostType)) {
    throw new Error("type is required");
  }

  return value as PostType;
};

export const parseLineActionData = (rawData: string): LineWebhookActionPayload => {
  const parsed = JSON.parse(rawData) as Partial<LineWebhookActionPayload>;
  if (!parsed || typeof parsed.action !== "string" || !isCandidateAction(parsed.action)) {
    throw new Error("unsupported line action");
  }

  if (parsed.action === "select_candidate" || parsed.action === "confirm_post" || parsed.action === "cancel_post") {
    return {
      action: parsed.action,
      candidateId: assertString(parsed.candidateId, "candidateId"),
    };
  }

  if (parsed.action === "skip_batch") {
    return {
      action: parsed.action,
      deliveryBatchId: assertString(parsed.deliveryBatchId, "deliveryBatchId"),
    };
  }

  return {
    action: parsed.action,
    deliveryBatchId: assertString(parsed.deliveryBatchId, "deliveryBatchId"),
    ideaId: assertString(parsed.ideaId, "ideaId"),
    type: assertPostType(parsed.type),
    count: assertCount(parsed.count),
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

  private async sendMessages(endpoint: string, payload: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.channelAccessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`line message failed: ${response.status} ${body}`);
    }
  }

  async replyMessages(replyToken: string, messages: LineMessage[]): Promise<void> {
    if (!this.channelAccessToken || !replyToken || messages.length === 0) {
      return;
    }

    await this.sendMessages(LINE_REPLY_ENDPOINT, {
      replyToken,
      messages,
    });
  }

  async replyText(replyToken: string, text: string): Promise<void> {
    await this.replyMessages(replyToken, [{ type: "text", text }]);
  }

  buildSelectionConfirmationMessage(candidate: Candidate): LineMessage {
    return {
      type: "flex",
      altText: "投稿確認",
      contents: {
        type: "bubble",
        size: "mega",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "投稿しますか？",
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: truncate(candidate.hook, 80),
              size: "sm",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: truncate(candidate.body, 240),
              size: "sm",
              wrap: true,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              action: {
                type: "postback",
                label: "はい",
                data: encodeActionData({
                  action: "confirm_post",
                  candidateId: candidate.candidateId,
                }),
                displayText: "はい",
              },
            },
            {
              type: "button",
              style: "secondary",
              action: {
                type: "postback",
                label: "いいえ",
                data: encodeActionData({
                  action: "cancel_post",
                  candidateId: candidate.candidateId,
                }),
                displayText: "いいえ",
              },
            },
          ],
        },
      },
    };
  }

  private buildIntroMessage(candidates: Candidate[]): LineMessage {
    const type = candidates[0]?.type ?? "awareness";
    return {
      type: "text",
      text:
        type === "viral"
          ? `今日は${TYPE_LABELS[type]}だよ。気になる案を見てみてね。`
          : `今日は${TYPE_LABELS[type]}だよ。気になる案を選んでね。`,
    };
  }

  private buildCandidateBubble(candidate: Candidate): LineMessage {
    return {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: buildColumnTitle(candidate),
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "text",
            text: truncate(candidate.body, 240),
            size: "sm",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "postback",
              label: "これにする！",
              data: encodeActionData({
                action: "select_candidate",
                candidateId: candidate.candidateId,
              }),
              displayText: `${candidate.hook} を選ぶ`,
            },
          },
        ],
      },
    };
  }

  private buildOperationsBubble(lastCandidate: Candidate, count: number): LineMessage {
    return {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "操作",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: "別案が欲しいときは再生成、今回は見送るなら投稿しないを押してね。",
            size: "sm",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            action: {
              type: "postback",
              label: "再生成する",
              data: encodeActionData({
                action: "regenerate_batch",
                deliveryBatchId: lastCandidate.deliveryBatchId,
                ideaId: lastCandidate.ideaId,
                type: lastCandidate.type,
                count,
              }),
              displayText: "再生成する",
            },
          },
          {
            type: "button",
            style: "link",
            action: {
              type: "postback",
              label: "今回は投稿しない",
              data: encodeActionData({
                action: "skip_batch",
                deliveryBatchId: lastCandidate.deliveryBatchId,
              }),
              displayText: "今回は投稿しない",
            },
          },
        ],
      },
    };
  }

  private buildCandidateCarouselMessages(candidates: Candidate[]): LineMessage[] {
    if (candidates.length === 0) {
      return [];
    }

    const lastCandidate = candidates[candidates.length - 1]!;
    const chunks: Candidate[][] = [];
    for (let index = 0; index < candidates.length; index += MAX_CANDIDATE_COLUMNS_PER_CAROUSEL) {
      chunks.push(candidates.slice(index, index + MAX_CANDIDATE_COLUMNS_PER_CAROUSEL));
    }

    return chunks.map((chunk, chunkIndex) => {
      const isLastChunk = chunkIndex === chunks.length - 1;
      const contents = chunk.map((candidate) => this.buildCandidateBubble(candidate));

      if (isLastChunk) {
        contents.push(this.buildOperationsBubble(lastCandidate, candidates.length));
      }

      return {
        type: "flex",
        altText: "投稿候補一覧",
        contents: {
          type: "carousel",
          contents,
        },
      };
    });
  }

  async pushCandidates(userId: string, candidates: Candidate[]): Promise<void> {
    if (!this.channelAccessToken || !userId || candidates.length === 0) {
      return;
    }

    const messages = [this.buildIntroMessage(candidates), ...this.buildCandidateCarouselMessages(candidates)];
    await this.sendMessages(LINE_PUSH_ENDPOINT, {
      to: userId,
      messages,
    });
  }
}
