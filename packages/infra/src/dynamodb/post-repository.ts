import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { Post, UpdateSpreadsheetSyncInput } from "@ph4k/core";

const POST_PK = "POST";
const SPREADSHEET_SYNC_STATUS_UPDATED_AT_INDEX = "spreadsheetSyncStatusUpdatedAtIndex";

export class DynamoPostRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async listPosts(): Promise<Post[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": POST_PK,
        },
      }),
    );

    return ((result.Items ?? []) as Post[]).sort((a, b) => {
      const left = a.postedAt ?? "";
      const right = b.postedAt ?? "";
      return right.localeCompare(left);
    });
  }

  async getPost(postId: string): Promise<Post | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: POST_PK,
          sk: postId,
        },
      }),
    );

    return (result.Item as Post | undefined) ?? null;
  }

  async listFailedSpreadsheetSyncPosts(): Promise<Post[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: SPREADSHEET_SYNC_STATUS_UPDATED_AT_INDEX,
        KeyConditionExpression: "spreadsheetSyncStatus = :spreadsheetSyncStatus",
        ExpressionAttributeValues: {
          ":spreadsheetSyncStatus": "failed",
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []) as Post[];
  }

  async createPost(
    input: Omit<Post, "postId" | "updatedAt">,
  ): Promise<Post> {
    const postId = randomUUID();
    const item: Post & { pk: string; sk: string } = {
      ...input,
      postId,
      updatedAt: new Date().toISOString(),
      pk: POST_PK,
      sk: postId,
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

  async updateLatestMetrics(
    postId: string,
    metrics: Pick<
      Post,
      | "latestImpressions"
      | "latestLikes"
      | "latestReplies"
      | "latestReposts"
      | "latestBookmarks"
      | "latestUrlLinkClicks"
    >,
  ): Promise<Post | null> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: POST_PK,
          sk: postId,
        },
        UpdateExpression:
          "SET latestImpressions = :latestImpressions, latestLikes = :latestLikes, latestReplies = :latestReplies, latestReposts = :latestReposts, latestBookmarks = :latestBookmarks, latestUrlLinkClicks = :latestUrlLinkClicks, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(sk)",
        ExpressionAttributeValues: {
          ":latestImpressions": metrics.latestImpressions,
          ":latestLikes": metrics.latestLikes,
          ":latestReplies": metrics.latestReplies,
          ":latestReposts": metrics.latestReposts,
          ":latestBookmarks": metrics.latestBookmarks,
          ":latestUrlLinkClicks": metrics.latestUrlLinkClicks,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return (result.Attributes as Post | undefined) ?? null;
  }

  async updateSpreadsheetSync(
    postId: string,
    input: UpdateSpreadsheetSyncInput,
  ): Promise<Post | null> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: POST_PK,
          sk: postId,
        },
        UpdateExpression:
          "SET spreadsheetSyncStatus = :spreadsheetSyncStatus, spreadsheetSyncAttempts = :spreadsheetSyncAttempts, spreadsheetLastSyncedAt = :spreadsheetLastSyncedAt, spreadsheetNextRetryAt = :spreadsheetNextRetryAt, spreadsheetSyncError = :spreadsheetSyncError, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(sk)",
        ExpressionAttributeValues: {
          ":spreadsheetSyncStatus": input.spreadsheetSyncStatus,
          ":spreadsheetSyncAttempts": input.spreadsheetSyncAttempts,
          ":spreadsheetLastSyncedAt": input.spreadsheetLastSyncedAt,
          ":spreadsheetNextRetryAt": input.spreadsheetNextRetryAt,
          ":spreadsheetSyncError": input.spreadsheetSyncError,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return (result.Attributes as Post | undefined) ?? null;
  }
}
