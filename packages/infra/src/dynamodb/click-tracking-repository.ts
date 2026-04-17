import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { ClickEvent, ClickTrackingLink } from "@ph4k/core";

const CLICK_LINK_PK_PREFIX = "LINK#";
const SHORT_ID_INDEX = "shortIdIndex";

export class DynamoClickTrackingRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async createLink(input: ClickTrackingLink): Promise<ClickTrackingLink> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...input,
          pk: `${CLICK_LINK_PK_PREFIX}${input.postId}`,
          sk: "META",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      }),
    );

    return input;
  }

  async getLinkByPostId(postId: string): Promise<ClickTrackingLink | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `${CLICK_LINK_PK_PREFIX}${postId}`,
          sk: "META",
        },
      }),
    );

    return (result.Item as ClickTrackingLink | undefined) ?? null;
  }

  async getLinkByShortId(shortId: string): Promise<ClickTrackingLink | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: SHORT_ID_INDEX,
        KeyConditionExpression: "shortId = :shortId AND sk = :sk",
        ExpressionAttributeValues: {
          ":shortId": shortId,
          ":sk": "META",
        },
        Limit: 1,
      }),
    );

    return ((result.Items ?? [])[0] as ClickTrackingLink | undefined) ?? null;
  }

  async createClickEvent(input: ClickEvent): Promise<ClickEvent> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...input,
          pk: `${CLICK_LINK_PK_PREFIX}${input.postId}`,
          sk: `CLICK#${input.clickedAt}#${randomUUID()}`,
        },
      }),
    );

    return input;
  }

  async countClicks(postId: string): Promise<number> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `${CLICK_LINK_PK_PREFIX}${postId}`,
          ":sk": "CLICK#",
        },
        Select: "COUNT",
      }),
    );

    return result.Count ?? 0;
  }
}
