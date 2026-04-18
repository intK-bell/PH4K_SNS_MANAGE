import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { Candidate, GeneratedCandidateDraft, UpdateCandidateInput } from "@ph4k/core";

const CANDIDATE_PK = "CANDIDATE";
const LINE_DELIVERY_STATUS_UPDATED_AT_INDEX = "lineDeliveryStatusUpdatedAtIndex";

export class DynamoCandidateRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async listCandidates(): Promise<Candidate[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": CANDIDATE_PK,
        },
      }),
    );

    return ((result.Items ?? []) as Candidate[]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getCandidate(candidateId: string): Promise<Candidate | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: CANDIDATE_PK,
          sk: candidateId,
        },
      }),
    );

    return (result.Item as Candidate | undefined) ?? null;
  }

  async listFailedCandidates(): Promise<Candidate[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: LINE_DELIVERY_STATUS_UPDATED_AT_INDEX,
        KeyConditionExpression: "lineDeliveryStatus = :lineDeliveryStatus",
        ExpressionAttributeValues: {
          ":lineDeliveryStatus": "failed",
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []) as Candidate[];
  }

  async listCandidatesByDeliveryBatchId(deliveryBatchId: string): Promise<Candidate[]> {
    const items = await this.listCandidates();
    return items
      .filter((item) => item.deliveryBatchId === deliveryBatchId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createCandidates(
    ideaId: string,
    drafts: GeneratedCandidateDraft[],
  ): Promise<Candidate[]> {
    const created: Candidate[] = [];
    const deliveryBatchId = randomUUID();

    for (const draft of drafts) {
      const timestamp = new Date().toISOString();
      const candidateId = randomUUID();
      const item: Candidate & { pk: string; sk: string } = {
        pk: CANDIDATE_PK,
        sk: candidateId,
        candidateId,
        ideaId,
        deliveryBatchId,
        type: draft.type,
        hook: draft.hook,
        body: draft.body,
        selected: false,
        status: "generated",
        promptVersion: draft.promptVersion,
        lineDeliveryStatus: "not_sent",
        lineDeliveryAttempts: 0,
        lineLastAttemptAt: null,
        lineNextRetryAt: null,
        lineLastError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );

      created.push(item);
    }

    return created;
  }

  async updateCandidate(
    candidateId: string,
    input: UpdateCandidateInput,
  ): Promise<Candidate | null> {
    const updates: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) {
        continue;
      }
      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      updates.push(`${nameKey} = ${valueKey}`);
      names[nameKey] = key;
      values[valueKey] = value;
    }

    names["#updatedAt"] = "updatedAt";
    values[":updatedAt"] = new Date().toISOString();
    updates.push("#updatedAt = :updatedAt");

    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: CANDIDATE_PK,
          sk: candidateId,
        },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ConditionExpression: "attribute_exists(sk)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );

    return (result.Attributes as Candidate | undefined) ?? null;
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: CANDIDATE_PK,
          sk: candidateId,
        },
      }),
    );
  }
}
