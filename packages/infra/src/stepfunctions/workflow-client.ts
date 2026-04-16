import { randomUUID } from "node:crypto";
import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import type { GenerateCandidatesInput } from "@ph4k/core";

export class WorkflowClient {
  constructor(
    private readonly client: SFNClient,
    private readonly candidateDeliveryStateMachineArn: string,
    private readonly postPublishStateMachineArn: string,
  ) {}

  isPostPublishConfigured(): boolean {
    return this.postPublishStateMachineArn.trim() !== "";
  }

  isCandidateDeliveryConfigured(): boolean {
    return this.candidateDeliveryStateMachineArn.trim() !== "";
  }

  async startCandidateDeliveryExecution(input: GenerateCandidatesInput): Promise<{
    executionArn: string;
    mode: "started" | "planned";
  }> {
    if (!this.isCandidateDeliveryConfigured()) {
      return {
        executionArn: `planned:${input.ideaId}:${randomUUID()}`,
        mode: "planned",
      };
    }

    const result = await this.client.send(
      new StartExecutionCommand({
        stateMachineArn: this.candidateDeliveryStateMachineArn,
        name: `candidate-delivery-${input.ideaId}-${Date.now()}`,
        input: JSON.stringify(input),
      }),
    );

    return {
      executionArn: result.executionArn ?? "",
      mode: "started",
    };
  }

  async startPostPublishExecution(candidateId: string): Promise<{
    executionArn: string;
    mode: "started" | "planned";
  }> {
    if (!this.isPostPublishConfigured()) {
      return {
        executionArn: `planned:${candidateId}:${randomUUID()}`,
        mode: "planned",
      };
    }

    const result = await this.client.send(
      new StartExecutionCommand({
        stateMachineArn: this.postPublishStateMachineArn,
        name: `post-publish-${candidateId}-${Date.now()}`,
        input: JSON.stringify({ candidateId }),
      }),
    );

    return {
      executionArn: result.executionArn ?? "",
      mode: "started",
    };
  }
}

export const createWorkflowClient = (
  region: string,
  candidateDeliveryStateMachineArn: string,
  postPublishStateMachineArn: string,
): WorkflowClient =>
  new WorkflowClient(
    new SFNClient({ region }),
    candidateDeliveryStateMachineArn,
    postPublishStateMachineArn,
  );
