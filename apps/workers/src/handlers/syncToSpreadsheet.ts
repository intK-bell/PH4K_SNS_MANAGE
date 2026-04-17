import { randomUUID } from "node:crypto";
import { GoogleSheetsClient } from "@ph4k/adapters";
import type { AnalysisRow, IdeaBacklogRow, PostManagementRow } from "@ph4k/core";
import { loadEnv } from "@ph4k/config";
import {
  createLogger,
  createDynamoDocumentClient,
  DynamoCandidateRepository,
  DynamoIdeaRepository,
  DynamoPostRepository,
} from "@ph4k/infra";
import { buildNextRetryAt, retry } from "../lib/retry.js";
import { validateSyncToSpreadsheetInput } from "../lib/sync-to-spreadsheet-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const postRepository = new DynamoPostRepository(client, env.postsTableName);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);
const ideaRepository = new DynamoIdeaRepository(client, env.ideasTableName);
const sheetsClient = new GoogleSheetsClient({
  clientEmail: env.googleServiceAccountEmail,
  privateKey: env.googleServiceAccountPrivateKey,
  spreadsheetId: env.googleSpreadsheetId,
});

const formatLikeRate = (likes: number | null, impressions: number | null): string => {
  if (!likes || !impressions) {
    return "";
  }
  return `${((likes / impressions) * 100).toFixed(2)}%`;
};

const safeAverage = (values: number[]): string => {
  if (values.length === 0) {
    return "";
  }
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
};

const buildRow = (
  post: NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>,
  candidate: NonNullable<Awaited<ReturnType<typeof candidateRepository.getCandidate>>>,
  idea: NonNullable<Awaited<ReturnType<typeof ideaRepository.getIdea>>>,
): PostManagementRow => ({
  id: post.postId,
  postedDate: post.postedAt ?? "",
  type: candidate.type,
  ideaTitle: idea.title,
  hook: candidate.hook,
  body: candidate.body,
  status: post.status,
  impressions: post.latestImpressions?.toString() ?? "",
  likes: post.latestLikes?.toString() ?? "",
  bookmarks: post.latestBookmarks?.toString() ?? "",
  replies: post.latestReplies?.toString() ?? "",
  urlLinkClicks: post.latestUrlLinkClicks?.toString() ?? "",
  likeRate: formatLikeRate(post.latestLikes, post.latestImpressions),
  evaluation: "",
  horizontalExpansion: "",
  postUrl: post.postUrl ?? "",
  memo: "",
});

const buildAnalysisRows = (
  posts: Array<NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>>,
  candidatesById: Map<string, NonNullable<Awaited<ReturnType<typeof candidateRepository.getCandidate>>>>,
  ideasById: Map<string, NonNullable<Awaited<ReturnType<typeof ideaRepository.getIdea>>>>,
): AnalysisRow[] => {
  const grouped = new Map<
    string,
    {
      posts: Array<NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>>;
      latestPost: NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>> | null;
    }
  >();

  for (const post of posts) {
    const candidate = candidatesById.get(post.candidateId);
    if (!candidate) {
      continue;
    }

    const current = grouped.get(candidate.type) ?? { posts: [], latestPost: null };
    current.posts.push(post);
    if (!current.latestPost || (post.postedAt ?? "") > (current.latestPost.postedAt ?? "")) {
      current.latestPost = post;
    }
    grouped.set(candidate.type, current);
  }

  const allRows: AnalysisRow[] = [];
  const totals = posts.filter((post) => candidatesById.has(post.candidateId));
  const latestTotalPost = [...totals].sort((a, b) =>
    (b.postedAt ?? "").localeCompare(a.postedAt ?? ""),
  )[0];

  const buildAggregateRow = (
    segment: string,
    type: string,
    targetPosts: Array<NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>>,
    latestPost: NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>> | null,
  ): AnalysisRow => {
    const impressions = targetPosts
      .map((post) => post.latestImpressions)
      .filter((value): value is number => value !== null);
    const likes = targetPosts
      .map((post) => post.latestLikes)
      .filter((value): value is number => value !== null);
    const bookmarks = targetPosts
      .map((post) => post.latestBookmarks)
      .filter((value): value is number => value !== null);
    const replies = targetPosts
      .map((post) => post.latestReplies)
      .filter((value): value is number => value !== null);
    const urlLinkClicks = targetPosts
      .map((post) => post.latestUrlLinkClicks)
      .filter((value): value is number => value !== null);
    const likeRates = targetPosts
      .map((post) =>
        post.latestLikes !== null &&
        post.latestImpressions !== null &&
        post.latestImpressions > 0
          ? (post.latestLikes / post.latestImpressions) * 100
          : null,
      )
      .filter((value): value is number => value !== null);

    const latestIdeaTitle = latestPost
      ? ideasById.get(latestPost.ideaId)?.title ?? ""
      : "";

    return {
      segment,
      type,
      postCount: String(targetPosts.length),
      averageImpressions: safeAverage(impressions),
      averageLikes: safeAverage(likes),
      averageBookmarks: safeAverage(bookmarks),
      averageReplies: safeAverage(replies),
      averageUrlLinkClicks: safeAverage(urlLinkClicks),
      averageLikeRate: likeRates.length > 0 ? `${safeAverage(likeRates)}%` : "",
      latestPostedDate: latestPost?.postedAt ?? "",
      latestIdeaTitle,
      latestPostId: latestPost?.postId ?? "",
    };
  };

  allRows.push(buildAggregateRow("total", "all", totals, latestTotalPost ?? null));

  for (const [type, aggregate] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    allRows.push(
      buildAggregateRow("type", type, aggregate.posts, aggregate.latestPost),
    );
  }

  return allRows;
};

const buildIdeaBacklogRows = (
  ideas: Array<NonNullable<Awaited<ReturnType<typeof ideaRepository.getIdea>>>>,
): IdeaBacklogRow[] =>
  ideas
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((idea) => ({
      ideaId: idea.ideaId,
      title: idea.title,
      problem: idea.problem,
      detail: idea.detail,
      priority: String(idea.priority),
      tags: idea.tags.join(", "),
      status: idea.status,
      useCount: String(idea.useCount),
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
    }));

export const handler = async (event: unknown) => {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const logger = createLogger({
    correlationId,
    component: "workers.syncToSpreadsheet",
    operation: "sync_to_spreadsheet",
  });

  const input = validateSyncToSpreadsheetInput(event);
  logger.info("spreadsheet sync started", {
    postId: input.postId,
    spreadsheetConfigured: sheetsClient.isConfigured(),
  });

  const post = await postRepository.getPost(input.postId);

  if (!post) {
    logger.error("spreadsheet sync failed: post not found", undefined, {
      postId: input.postId,
      durationMs: Date.now() - startedAt,
    });
    throw new Error("post not found");
  }

  const candidate = await candidateRepository.getCandidate(post.candidateId);
  if (!candidate) {
    throw new Error("candidate not found");
  }

  const idea = await ideaRepository.getIdea(post.ideaId);
  if (!idea) {
    throw new Error("idea not found");
  }

  const row = buildRow(post, candidate, idea);
  const attemptedAt = new Date();

  try {
    const result = await retry(() => sheetsClient.upsertPostManagementRow(row), {
      attempts: 3,
      initialDelayMs: 1000,
      onRetry: async (attempt, error, nextDelayMs) => {
        logger.warn("spreadsheet sync retry scheduled", {
          stage: "post_management",
          attempt,
          nextDelayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          postId: post.postId,
        });
      },
    });

    const allPosts = await postRepository.listPosts();
    const candidateIds = [...new Set(allPosts.map((item) => item.candidateId))];
    const ideaIds = [...new Set(allPosts.map((item) => item.ideaId))];

    const allCandidates = await Promise.all(
      candidateIds.map((candidateId) => candidateRepository.getCandidate(candidateId)),
    );
    const allIdeas = await Promise.all(
      ideaIds.map((ideaId) => ideaRepository.getIdea(ideaId)),
    );
    const listedIdeas = await ideaRepository.listIdeas();

    const candidatesById = new Map(
      allCandidates
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => [item.candidateId, item]),
    );
    const ideasById = new Map(
      allIdeas
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => [item.ideaId, item]),
    );

    const analysisRows = buildAnalysisRows(allPosts, candidatesById, ideasById);
    const analysisResult = await retry(() => sheetsClient.replaceAnalysisRows(analysisRows), {
      attempts: 3,
      initialDelayMs: 1000,
      onRetry: async (attempt, error, nextDelayMs) => {
        logger.warn("spreadsheet sync retry scheduled", {
          stage: "analysis",
          attempt,
          nextDelayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          postId: post.postId,
        });
      },
    });
    const ideaBacklogRows = buildIdeaBacklogRows(listedIdeas);
    const ideaBacklogResult = await retry(
      () => sheetsClient.replaceIdeaBacklogRows(ideaBacklogRows),
      {
        attempts: 3,
        initialDelayMs: 1000,
        onRetry: async (attempt, error, nextDelayMs) => {
          logger.warn("spreadsheet sync retry scheduled", {
            stage: "idea_backlog",
            attempt,
            nextDelayMs,
            errorMessage: error instanceof Error ? error.message : String(error),
            postId: post.postId,
          });
        },
      },
    );

    const syncedPost = await postRepository.updateSpreadsheetSync(post.postId, {
      spreadsheetSyncStatus: "synced",
      spreadsheetSyncAttempts: post.spreadsheetSyncAttempts + 1,
      spreadsheetLastSyncedAt: attemptedAt.toISOString(),
      spreadsheetNextRetryAt: null,
      spreadsheetSyncError: null,
    });

    logger.info("spreadsheet sync completed", {
      postId: post.postId,
      postManagementMode: result.mode,
      analysisRowCount: analysisResult.rowCount,
      ideaBacklogRowCount: ideaBacklogResult.rowCount,
      spreadsheetSyncAttempts: syncedPost?.spreadsheetSyncAttempts ?? null,
      durationMs: Date.now() - startedAt,
    });

    return {
      correlationId,
      configured: sheetsClient.isConfigured(),
      postManagement: {
        mode: result.mode,
        row,
      },
      analysis: {
        rowCount: analysisResult.rowCount,
        rows: analysisRows,
      },
      ideaBacklog: {
        rowCount: ideaBacklogResult.rowCount,
        rows: ideaBacklogRows,
      },
      post: syncedPost,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown sheets sync error";
    const failedPost = await postRepository.updateSpreadsheetSync(post.postId, {
      spreadsheetSyncStatus: "failed",
      spreadsheetSyncAttempts: post.spreadsheetSyncAttempts + 1,
      spreadsheetLastSyncedAt: post.spreadsheetLastSyncedAt,
      spreadsheetNextRetryAt: buildNextRetryAt(attemptedAt, 15 * 60 * 1000),
      spreadsheetSyncError: message,
    });

    logger.error("spreadsheet sync failed", error, {
      postId: post.postId,
      spreadsheetSyncAttempts: failedPost?.spreadsheetSyncAttempts ?? null,
      spreadsheetNextRetryAt: failedPost?.spreadsheetNextRetryAt ?? null,
      durationMs: Date.now() - startedAt,
    });

    throw new Error(
      JSON.stringify({
        correlationId,
        message,
        postId: post.postId,
        spreadsheetSyncStatus: failedPost?.spreadsheetSyncStatus ?? "failed",
      }),
    );
  }
};
