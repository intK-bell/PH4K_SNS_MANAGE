import { randomUUID } from "node:crypto";
import { XMetricsClient } from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import {
  createLogger,
  createDynamoDocumentClient,
  DynamoMetricRepository,
  DynamoPostRepository,
} from "@ph4k/infra";
import { validateFetchPostMetricsInput } from "../lib/fetch-post-metrics-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const postRepository = new DynamoPostRepository(client, env.postsTableName);
const metricRepository = new DynamoMetricRepository(client, env.metricsTableName);
const xMetricsClient = new XMetricsClient({
  apiKey: env.xApiKey,
  apiKeySecret: env.xApiKeySecret,
  bearerToken: env.xBearerToken,
  accessToken: env.xAccessToken,
  accessTokenSecret: env.xAccessTokenSecret,
});

export const handler = async (event: unknown) => {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const logger = createLogger({
    correlationId,
    component: "workers.fetchPostMetrics",
    operation: "fetch_post_metrics",
  });

  const input = validateFetchPostMetricsInput(event);
  logger.info("metrics fetch started", {
    postId: input.postId,
    offsetHours: input.offsetHours ?? null,
  });

  const post = await postRepository.getPost(input.postId);

  if (!post) {
    logger.error("metrics fetch failed: post not found", undefined, {
      postId: input.postId,
      durationMs: Date.now() - startedAt,
    });
    throw new Error("post not found");
  }

  try {
    const fetchedAt = new Date().toISOString();
    const metrics = await xMetricsClient.fetchMetrics(post, input.offsetHours);
    const snapshot = await metricRepository.createMetricSnapshot({
      postId: post.postId,
      fetchedAt,
      ...metrics,
    });

    const updatedPost = await postRepository.updateLatestMetrics(post.postId, {
      latestImpressions: snapshot.impressions,
      latestLikes: snapshot.likes,
      latestReplies: snapshot.replies,
      latestReposts: snapshot.reposts,
      latestBookmarks: snapshot.bookmarks,
      latestUrlLinkClicks: snapshot.urlLinkClicks,
    });

    logger.info("metrics fetch completed", {
      postId: post.postId,
      fetchedAt,
      impressions: snapshot.impressions,
      likes: snapshot.likes,
      replies: snapshot.replies,
      reposts: snapshot.reposts,
      bookmarks: snapshot.bookmarks,
      urlLinkClicks: snapshot.urlLinkClicks,
      durationMs: Date.now() - startedAt,
    });

    return {
      correlationId,
      post: updatedPost,
      metricSnapshot: snapshot,
    };
  } catch (error) {
    logger.error("metrics fetch failed", error, {
      postId: post.postId,
      offsetHours: input.offsetHours ?? null,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
};
