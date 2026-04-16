import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { CreateIdeaInput, Idea, UpdateIdeaInput } from "@ph4k/core";

const IDEA_PK = "IDEA";

export class DynamoIdeaRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async listIdeas(): Promise<Idea[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": IDEA_PK,
        },
      }),
    );

    const items = (result.Items ?? []) as Idea[];
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getIdea(ideaId: string): Promise<Idea | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: IDEA_PK,
          sk: ideaId,
        },
      }),
    );

    return (result.Item as Idea | undefined) ?? null;
  }

  async createIdea(input: CreateIdeaInput): Promise<Idea> {
    const timestamp = new Date().toISOString();
    const ideaId = randomUUID();
    const item: Idea & { pk: string; sk: string } = {
      pk: IDEA_PK,
      sk: ideaId,
      ideaId,
      title: input.title,
      problem: input.problem,
      detail: input.detail,
      priority: input.priority,
      tags: input.tags,
      status: "active",
      useCount: 0,
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

    return item;
  }

  async updateIdea(ideaId: string, input: UpdateIdeaInput): Promise<Idea | null> {
    const updates: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    const entries = Object.entries(input).filter(([, value]) => value !== undefined);
    for (const [key, value] of entries) {
      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      updates.push(`${nameKey} = ${valueKey}`);
      names[nameKey] = key;
      values[valueKey] = value;
    }

    names["#updatedAt"] = "updatedAt";
    values[":updatedAt"] = new Date().toISOString();
    updates.push("#updatedAt = :updatedAt");

    if (updates.length === 1) {
      return this.getIdea(ideaId);
    }

    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: IDEA_PK,
          sk: ideaId,
        },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ConditionExpression: "attribute_exists(sk)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );

    return (result.Attributes as Idea | undefined) ?? null;
  }
}
