import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { MetricSnapshot } from "@ph4k/core";

const METRIC_PK = "METRIC";

export class DynamoMetricRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async createMetricSnapshot(input: MetricSnapshot): Promise<MetricSnapshot> {
    const item: MetricSnapshot & { pk: string; sk: string } = {
      ...input,
      pk: METRIC_PK,
      sk: `${input.postId}#${input.fetchedAt}#${randomUUID()}`,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return input;
  }

  async listMetricSnapshots(postId: string): Promise<MetricSnapshot[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": METRIC_PK,
          ":sk": `${postId}#`,
        },
      }),
    );

    return ((result.Items ?? []) as MetricSnapshot[]).sort((a, b) =>
      b.fetchedAt.localeCompare(a.fetchedAt),
    );
  }

  async deleteMetricSnapshots(postId: string): Promise<void> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": METRIC_PK,
          ":sk": `${postId}#`,
        },
      }),
    );

    for (const item of result.Items ?? []) {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: METRIC_PK,
            sk: item.sk,
          },
        }),
      );
    }
  }
}
