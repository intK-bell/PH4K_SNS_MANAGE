import {
  LineMessagingClient,
  OpenAiCandidateTranslator,
  parseLineActionData,
} from "@ph4k/adapters";
import type {
  Candidate,
  GenerateCandidatesInput,
  LineWebhookEvent,
  LineWebhookRequest,
  PostType,
} from "@ph4k/core";
import {
  DynamoCandidateRepository,
  DynamoIdeaRepository,
  WorkflowClient,
} from "@ph4k/infra";
import { HttpError } from "../lib/http.js";

const SALES_TRIGGER_TEXT = "種まきだ！";
const VIRAL_TRIGGER_TEXT = "収穫だ！";
const CURRENT_AFFAIRS_TRIGGER_TEXT = "時事ネタ";
const DEFAULT_TRIGGER_COUNT = 5;
const TRIGGER_START_MESSAGES: Record<"sales" | "current_affairs" | "harvest", string> = {
  sales: "種まき案を作りよるけん、ちょい待ってね。",
  current_affairs: "時事ネタ案を作りよるけん、ちょい待ってね。",
  harvest: "収穫案を作りよるけん、ちょい待ってね。",
};
const INTERNAL_IDEA_KEYWORDS = [
  "e2e",
  "test",
  "line",
  "google sheets",
  "sheets",
  "metrics",
  "step functions",
  "webhook",
  "candidate",
  "再実行",
  "テスト",
  "運用フロー",
];
const TOKYO_WEEKDAY_TO_POST_TYPE: Record<string, PostType> = {
  Mon: "awareness",
  Tue: "overtime",
  Wed: "before_after",
  Thu: "double_question",
  Fri: "light_achievement",
  Sat: "cta",
  Sun: "constraint",
};

export class WebhookService {
  constructor(
    private readonly lineClient: LineMessagingClient,
    private readonly candidateRepository: DynamoCandidateRepository,
    private readonly ideaRepository: DynamoIdeaRepository,
    private readonly workflowClient: WorkflowClient,
    private readonly candidateTranslator: OpenAiCandidateTranslator,
    private readonly enableXPublish: boolean,
    private readonly authorizedLineUserId: string,
  ) {}

  private buildConfirmationText(candidate: Candidate): string {
    return [candidate.hook.trim(), candidate.body.trim()]
      .filter((section) => section !== "")
      .join("\n")
      .trim();
  }

  verifySignature(body: string, signature: string | undefined) {
    if (!signature || !this.lineClient.verifySignature(body, signature)) {
      throw new HttpError(401, "invalid line signature");
    }
  }

  private isAuthorizedLineUser(event: LineWebhookEvent): boolean {
    return (
      this.authorizedLineUserId.trim() !== "" &&
      event.source?.userId === this.authorizedLineUserId
    );
  }

  private resolveTodaySalesType(): PostType {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      weekday: "short",
    }).format(new Date());

    return TOKYO_WEEKDAY_TO_POST_TYPE[weekday] ?? "awareness";
  }

  private async resolveLatestActiveIdeaId(): Promise<string> {
    const ideas = await this.ideaRepository.listIdeas();
    const activeIdeas = ideas.filter((idea) => idea.status === "active");
    const latest =
      activeIdeas.find((idea) => {
        const haystack = [idea.title, idea.problem, idea.detail]
          .join("\n")
          .toLowerCase();

        return !INTERNAL_IDEA_KEYWORDS.some((keyword) => haystack.includes(keyword));
      }) ?? activeIdeas[0];

    if (!latest) {
      throw new HttpError(404, "active idea not found");
    }

    return latest.ideaId;
  }

  private async closeBatch(
    deliveryBatchId: string,
    selectedCandidateId?: string,
    selectedStatus: "confirming" | "closed" = "closed",
  ) {
    const batchCandidates = await this.candidateRepository.listCandidatesByDeliveryBatchId(
      deliveryBatchId,
    );

    await Promise.all(
      batchCandidates.map((batchCandidate) =>
        this.candidateRepository.updateCandidate(batchCandidate.candidateId, {
          selected: batchCandidate.candidateId === selectedCandidateId,
          status:
            batchCandidate.candidateId === selectedCandidateId
              ? selectedStatus
              : "closed",
        }),
      ),
    );

    return batchCandidates;
  }

  private async startTriggeredDelivery(
    input: GenerateCandidatesInput,
    replyToken: string | undefined,
    startMessage: string,
  ) {
    if (replyToken) {
      await this.lineClient.replyText(replyToken, startMessage);
    }

    const execution = await this.workflowClient.startCandidateDeliveryExecution(input);
    return {
      trigger:
        input.type === "viral"
          ? "harvest"
          : input.type === "current_affairs"
            ? "current_affairs"
            : "sales",
      executionArn: execution.executionArn,
      mode: execution.mode,
      input,
    };
  }

  private resolveTriggerFromText(text: string): "sales" | "current_affairs" | "harvest" | null {
    if (text === SALES_TRIGGER_TEXT) {
      return "sales";
    }

    if (text === CURRENT_AFFAIRS_TRIGGER_TEXT) {
      return "current_affairs";
    }

    if (text === VIRAL_TRIGGER_TEXT) {
      return "harvest";
    }

    return null;
  }

  private resolveInputTypeFromTrigger(trigger: "sales" | "current_affairs" | "harvest"): PostType {
    if (trigger === "harvest") {
      return "viral";
    }

    if (trigger === "current_affairs") {
      return "current_affairs";
    }

    return this.resolveTodaySalesType();
  }

  async handleWebhook(payload: LineWebhookRequest) {
    const results = [];

    for (const event of payload.events) {
      if (!this.isAuthorizedLineUser(event)) {
        results.push({
          mode: "unauthorized",
          sourceType: event.source?.type ?? null,
        });
        continue;
      }

      if (event.type === "message" && event.message?.type === "text") {
        const text = event.message.text?.trim();
        const trigger = this.resolveTriggerFromText(text ?? "");
        if (!trigger) {
          continue;
        }

        const ideaId = await this.resolveLatestActiveIdeaId();
        const input: GenerateCandidatesInput = {
          ideaId,
          type: this.resolveInputTypeFromTrigger(trigger),
          count: DEFAULT_TRIGGER_COUNT,
        };

        const result = await this.startTriggeredDelivery(
          input,
          event.replyToken,
          TRIGGER_START_MESSAGES[trigger],
        );

        results.push(result);
        continue;
      }

      if (event.type !== "postback" || !event.postback?.data) {
        continue;
      }

      const actionPayload = parseLineActionData(event.postback.data);
      if (actionPayload.action === "select_post_language") {
        const candidate = await this.candidateRepository.getCandidate(actionPayload.candidateId!);
        if (!candidate) {
          throw new HttpError(404, "candidate not found");
        }

        if (candidate.status !== "confirming") {
          if (event.replyToken) {
            await this.lineClient.replyText(
              event.replyToken,
              "この候補はもう投稿言語を選べんばい。新しい候補を選んでね。",
            );
          }

          results.push({
            action: actionPayload.action,
            candidateId: candidate.candidateId,
            mode: "ignored",
          });
          continue;
        }

        const language = actionPayload.language ?? "ja";
        const translated =
          language === (candidate.language ?? "ja")
            ? { hook: candidate.hook, body: candidate.body }
            : await this.candidateTranslator.translate({
                hook: candidate.hook,
                body: candidate.body,
                language,
              });
        const updatedCandidate = await this.candidateRepository.updateCandidate(
          candidate.candidateId,
          {
            hook: translated.hook,
            body: translated.body,
            language,
          },
        );

        if (!updatedCandidate) {
          throw new HttpError(404, "candidate not found");
        }

        if (event.replyToken) {
          await this.lineClient.replyMessages(event.replyToken, [
            this.lineClient.buildSelectionConfirmationMessage(
              updatedCandidate.candidateId,
              this.buildConfirmationText(updatedCandidate),
            ),
          ]);
        }

        results.push({
          action: actionPayload.action,
          candidateId: updatedCandidate.candidateId,
          language,
          mode: "confirming",
        });
        continue;
      }

      if (
        actionPayload.action === "select_candidate" ||
        actionPayload.action === "confirm_post" ||
        actionPayload.action === "cancel_post"
      ) {
        const candidate = await this.candidateRepository.getCandidate(actionPayload.candidateId!);
        if (!candidate) {
          throw new HttpError(404, "candidate not found");
        }

        if (actionPayload.action === "select_candidate") {
          if (candidate.status !== "sent_to_line") {
            if (event.replyToken) {
              await this.lineClient.replyText(
                event.replyToken,
                "この候補はもう選べんばい。必要なら再生成してね。",
              );
            }

            results.push({
              action: actionPayload.action,
              candidateId: candidate.candidateId,
              mode: "ignored",
            });
            continue;
          }

          await this.closeBatch(candidate.deliveryBatchId, candidate.candidateId, "confirming");

          if (event.replyToken) {
            await this.lineClient.replyMessages(event.replyToken, [
              this.lineClient.buildPostLanguageSelectionMessage(
                candidate.candidateId,
                this.buildConfirmationText(candidate),
              ),
            ]);
          }

          results.push({
            action: actionPayload.action,
            candidateId: candidate.candidateId,
            deliveryBatchId: candidate.deliveryBatchId,
            mode: "language_selection",
          });
          continue;
        }

        if (actionPayload.action === "cancel_post") {
          await this.candidateRepository.updateCandidate(candidate.candidateId, {
            selected: false,
            status: "closed",
          });

          if (event.replyToken) {
            await this.lineClient.replyText(
              event.replyToken,
              "今回は見送ったばい。別案が欲しければ再生成してね。",
            );
          }

          results.push({
            action: actionPayload.action,
            candidateId: candidate.candidateId,
            mode: "cancelled",
          });
          continue;
        }

        if (candidate.status !== "confirming") {
          if (event.replyToken) {
            await this.lineClient.replyText(
              event.replyToken,
              "この候補はもう投稿確認の対象やなかばい。新しい候補を選んでね。",
            );
          }

          results.push({
            action: actionPayload.action,
            candidateId: candidate.candidateId,
            mode: "ignored",
          });
          continue;
        }

        await this.candidateRepository.updateCandidate(candidate.candidateId, {
          selected: true,
          status: this.enableXPublish ? "pending" : "closed",
        });

        if (!this.enableXPublish) {
          if (event.replyToken) {
            await this.lineClient.replyText(
              event.replyToken,
              "この案で確定したばい。今はX投稿せん設定やけん、候補確認までで止めとるよ。",
            );
          }

          results.push({
            action: actionPayload.action,
            candidateId: candidate.candidateId,
            mode: "selected_only",
          });
          continue;
        }

        const execution = await this.workflowClient.startPostPublishExecution(
          candidate.candidateId,
        );

        if (event.replyToken) {
          await this.lineClient.replyText(
            event.replyToken,
            "投稿を進めるばい。結果は順番に反映されるけん、ちょい待ってね。",
          );
        }

        results.push({
          action: actionPayload.action,
          candidateId: candidate.candidateId,
          executionArn: execution.executionArn,
          mode: execution.mode,
        });
        continue;
      }

      if (actionPayload.action === "skip_batch") {
        const batchCandidates = await this.candidateRepository.listCandidatesByDeliveryBatchId(
          actionPayload.deliveryBatchId!,
        );
        const hasOpenCandidate = batchCandidates.some((candidate) => candidate.status === "sent_to_line");

        if (!hasOpenCandidate) {
          if (event.replyToken) {
            await this.lineClient.replyText(
              event.replyToken,
              "この候補束はもう閉じとるばい。新しい候補を出してね。",
            );
          }

          results.push({
            action: actionPayload.action,
            deliveryBatchId: actionPayload.deliveryBatchId,
            mode: "ignored",
          });
          continue;
        }

        await this.closeBatch(actionPayload.deliveryBatchId!);

        if (event.replyToken) {
          await this.lineClient.replyText(
            event.replyToken,
            "今回は投稿せんことにしたばい。また必要なときに呼んでね。",
          );
        }

        results.push({
          action: actionPayload.action,
          deliveryBatchId: actionPayload.deliveryBatchId,
          mode: "closed",
        });
        continue;
      }

      const batchCandidates = await this.candidateRepository.listCandidatesByDeliveryBatchId(
        actionPayload.deliveryBatchId!,
      );
      const hasOpenCandidate = batchCandidates.some((candidate) => candidate.status === "sent_to_line");

      if (!hasOpenCandidate) {
        if (event.replyToken) {
          await this.lineClient.replyText(
            event.replyToken,
            "この候補束はもう閉じとるばい。必要なら新しく呼んでね。",
          );
        }

        results.push({
          action: actionPayload.action,
          deliveryBatchId: actionPayload.deliveryBatchId,
          mode: "ignored",
        });
        continue;
      }

      await this.closeBatch(actionPayload.deliveryBatchId!);
      const input: GenerateCandidatesInput = {
        ideaId: actionPayload.ideaId!,
        type: actionPayload.type!,
        count: actionPayload.count!,
        language: actionPayload.language ?? "ja",
      };

      if (event.replyToken) {
        await this.lineClient.replyText(
          event.replyToken,
          "別案を作り直しよるけん、ちょい待ってね。",
        );
      }

      const execution = await this.workflowClient.startCandidateDeliveryExecution(input);
      results.push({
        action: actionPayload.action,
        deliveryBatchId: actionPayload.deliveryBatchId,
        executionArn: execution.executionArn,
        mode: execution.mode,
      });
    }

    return results;
  }
}
