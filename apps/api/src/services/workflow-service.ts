import type { GenerateCandidatesInput } from "@ph4k/core";
import { WorkflowClient } from "@ph4k/infra";

export class WorkflowService {
  constructor(private readonly workflowClient: WorkflowClient) {}

  startCandidateDeliveryExecution(input: GenerateCandidatesInput) {
    return this.workflowClient.startCandidateDeliveryExecution(input);
  }
}
