import {
  LineMessagingClient,
  parseLineActionData,
} from "@ph4k/adapters";
import type { LineWebhookRequest } from "@ph4k/core";
import { DynamoCandidateRepository, WorkflowClient } from "@ph4k/infra";
import { HttpError } from "../lib/http.js";

export class WebhookService {
  constructor(
    private readonly lineClient: LineMessagingClient,
    private readonly candidateRepository: DynamoCandidateRepository,
    private readonly workflowClient: WorkflowClient,
  ) {}

  verifySignature(body: string, signature: string | undefined) {
    if (!signature || !this.lineClient.verifySignature(body, signature)) {
      throw new HttpError(401, "invalid line signature");
    }
  }

  async handleWebhook(payload: LineWebhookRequest) {
    const results = [];

    for (const event of payload.events) {
      if (event.type !== "postback" || !event.postback?.data) {
        continue;
      }

      const actionPayload = parseLineActionData(event.postback.data);
      const candidate = await this.candidateRepository.getCandidate(actionPayload.candidateId);
      if (!candidate) {
        throw new HttpError(404, "candidate not found");
      }

      if (actionPayload.action === "post") {
        await this.candidateRepository.updateCandidate(candidate.candidateId, {
          selected: true,
          status: "pending",
        });

        const execution = await this.workflowClient.startPostPublishExecution(
          candidate.candidateId,
        );

        results.push({
          action: actionPayload.action,
          candidateId: candidate.candidateId,
          executionArn: execution.executionArn,
          mode: execution.mode,
        });
        continue;
      }

      const mappedStatus =
        actionPayload.action === "hold"
          ? "held"
          : actionPayload.action === "discard"
            ? "discarded"
            : "regenerating";

      const updated = await this.candidateRepository.updateCandidate(candidate.candidateId, {
        selected: false,
        status: mappedStatus,
      });

      results.push({
        action: actionPayload.action,
        candidateId: updated?.candidateId ?? candidate.candidateId,
      });
    }

    return results;
  }
}
