import { randomUUID } from "node:crypto";
import { GoogleSheetsClient } from "@ph4k/adapters";
import type { AnalysisRow, IdeaBacklogRow, KpiRow, PostManagementRow } from "@ph4k/core";
import { loadEnv } from "@ph4k/config";
import {
  createLogger,
  DynamoClickTrackingRepository,
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
const clickTrackingRepository = new DynamoClickTrackingRepository(client, env.clicksTableName);
const sheetsClient = new GoogleSheetsClient({
  clientEmail: env.googleServiceAccountEmail,
  privateKey: env.googleServiceAccountPrivateKey,
  spreadsheetId: env.googleSpreadsheetId,
});
const JST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const PROFILE_TRACKING_POST_ID = "PROFILE#x";
const POST_LINK_CLICK_OFFSET = 2;

const normalizePostClickCount = (rawCount: number): number =>
  Math.max(rawCount - POST_LINK_CLICK_OFFSET, 0);

const normalizePostUrl = (value: string | null): string => {
  const raw = (value ?? "").trim();
  if (raw === "") {
    return "";
  }

  const publicBaseUrl = env.xAppBaseUrl.replace(/\/$/, "");
  const statusPathMatch = raw.match(/(\/i\/web\/status\/\d+)/);
  if (statusPathMatch?.[1]) {
    return `${publicBaseUrl}${statusPathMatch[1]}`;
  }

  if (raw.startsWith("/")) {
    return `${publicBaseUrl}${raw}`;
  }

  return raw;
};

const formatDateTimeJst = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = Object.fromEntries(
    JST_DATE_TIME_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} JST`;
};

const safeAverage = (values: number[]): string => {
  if (values.length === 0) {
    return "";
  }
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
};

const formatPercent = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "";
  }
  return `${value.toFixed(2)}%`;
};

const buildKpiRows = (
  posts: Array<NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>>,
  clickCountsByPostId: Map<string, number>,
  profileClickCount: number,
): KpiRow[] => {
  const totalImpressions = posts.reduce(
    (sum, post) => sum + (post.latestImpressions ?? 0),
    0,
  );
  const totalPostClicks = posts.reduce(
    (sum, post) => sum + (clickCountsByPostId.get(post.postId) ?? 0),
    0,
  );
  const totalLpClicks = totalPostClicks + profileClickCount;
  const impressionTarget = 500_000;
  const clickRateTarget = 5;
  const actualPostClickRate =
    totalImpressions > 0 ? (totalPostClicks / totalImpressions) * 100 : 0;
  const actualProfileClickRate =
    totalImpressions > 0 ? (profileClickCount / totalImpressions) * 100 : 0;
  const updatedAt = formatDateTimeJst(new Date().toISOString());
  const totalClickTarget = Math.round(impressionTarget * (clickRateTarget / 100));

  return [
    {
      kpiName: "累計imp",
      targetValue: impressionTarget.toLocaleString("ja-JP"),
      actualValue: totalImpressions.toLocaleString("ja-JP"),
      progressRate: formatPercent((totalImpressions / impressionTarget) * 100),
      status: totalImpressions >= impressionTarget ? "達成" : "進行中",
      note: "X投稿の latestImpressions 累計",
      updatedAt,
    },
    {
      kpiName: "X投稿→LPクリック率",
      targetValue: `${clickRateTarget.toFixed(2)}%`,
      actualValue: formatPercent(actualPostClickRate),
      progressRate: formatPercent((actualPostClickRate / clickRateTarget) * 100),
      status: actualPostClickRate >= clickRateTarget ? "達成" : "進行中",
      note: `投稿クリック ${totalPostClicks.toLocaleString("ja-JP")} / 累計imp ${totalImpressions.toLocaleString("ja-JP")}（投稿ごとに -${POST_LINK_CLICK_OFFSET} 補正）`,
      updatedAt,
    },
    {
      kpiName: "Xプロフ→LPクリック率",
      targetValue: "参考値",
      actualValue: formatPercent(actualProfileClickRate),
      progressRate: "",
      status: "観測",
      note: `プロフィールクリック ${profileClickCount.toLocaleString("ja-JP")} / 累計imp ${totalImpressions.toLocaleString("ja-JP")}`,
      updatedAt,
    },
    {
      kpiName: "累計LPクリック",
      targetValue: totalClickTarget.toLocaleString("ja-JP"),
      actualValue: totalLpClicks.toLocaleString("ja-JP"),
      progressRate: formatPercent(
        (totalLpClicks / totalClickTarget) * 100,
      ),
      status:
        totalLpClicks >= totalClickTarget
          ? "達成"
          : "進行中",
      note: `投稿 ${totalPostClicks.toLocaleString("ja-JP")} + プロフ ${profileClickCount.toLocaleString("ja-JP")}`,
      updatedAt,
    },
  ];
};

const buildRow = (
  post: NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>,
  candidate: NonNullable<Awaited<ReturnType<typeof candidateRepository.getCandidate>>>,
  idea: NonNullable<Awaited<ReturnType<typeof ideaRepository.getIdea>>>,
  clickCount: number,
): PostManagementRow => ({
  id: post.postId,
  postedDate: formatDateTimeJst(post.postedAt),
  type: candidate.type,
  ideaTitle: idea.title,
  hook: candidate.hook,
  body: candidate.body,
  status: post.status,
  impressions: post.latestImpressions?.toString() ?? "",
  likes: post.latestLikes?.toString() ?? "",
  bookmarks: post.latestBookmarks?.toString() ?? "",
  replies: post.latestReplies?.toString() ?? "",
  urlLinkClicks: String(clickCount),
  horizontalExpansion: "",
  postUrl: normalizePostUrl(post.postUrl),
  memo: "",
});

const buildAnalysisRows = (
  posts: Array<NonNullable<Awaited<ReturnType<typeof postRepository.getPost>>>>,
  candidatesById: Map<string, NonNullable<Awaited<ReturnType<typeof candidateRepository.getCandidate>>>>,
  ideasById: Map<string, NonNullable<Awaited<ReturnType<typeof ideaRepository.getIdea>>>>,
  clickCountsByPostId: Map<string, number>,
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
      .map((post) => clickCountsByPostId.get(post.postId) ?? 0)
      .filter((value): value is number => value >= 0);
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
      averageLikeRate:
        segment === "total" && likeRates.length > 0 ? `${safeAverage(likeRates)}%` : "-",
      latestPostedDate: formatDateTimeJst(latestPost?.postedAt ?? null),
      latestIdeaTitle,
      latestPostId: latestPost?.postId ?? "",
    };
  };

  allRows.push(buildAggregateRow("total", "all", totals, latestTotalPost ?? null));

  for (const [type, aggregate] of [...grouped.entries()].sort(([, left], [, right]) =>
    (right.latestPost?.postedAt ?? "").localeCompare(left.latestPost?.postedAt ?? ""),
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

  const attemptedAt = new Date();

  try {
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
    const rawClickCountsByPostId = new Map(
      await Promise.all(
        allPosts.map(async (item) => [item.postId, await clickTrackingRepository.countClicks(item.postId)] as const),
      ),
    );
    const clickCountsByPostId = new Map(
      [...rawClickCountsByPostId.entries()].map(([postId, count]) => [
        postId,
        normalizePostClickCount(count),
      ]),
    );
    const profileClickCount = await clickTrackingRepository.countClicks(PROFILE_TRACKING_POST_ID);

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

    const validPosts = allPosts.filter(
      (item) => candidatesById.has(item.candidateId) && ideasById.has(item.ideaId),
    );

    const postManagementRows = validPosts
      .slice()
      .sort((left, right) => (right.postedAt ?? "").localeCompare(left.postedAt ?? ""))
      .map((item) =>
        buildRow(
          item,
          candidatesById.get(item.candidateId)!,
          ideasById.get(item.ideaId)!,
          clickCountsByPostId.get(item.postId) ?? 0,
        ),
      );
    const currentRow = postManagementRows.find((item) => item.id === post.postId) ?? null;
    const postManagementResult = await retry(
      () => sheetsClient.replacePostManagementRows(postManagementRows),
      {
        attempts: 3,
        initialDelayMs: 1000,
        onRetry: async (attempt, error, nextDelayMs) => {
          logger.warn("spreadsheet sync retry scheduled", {
            stage: "post_management_replace",
            attempt,
            nextDelayMs,
            errorMessage: error instanceof Error ? error.message : String(error),
            postId: post.postId,
          });
        },
      },
    );

    const analysisRows = buildAnalysisRows(validPosts, candidatesById, ideasById, clickCountsByPostId);
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
    const kpiRows = buildKpiRows(validPosts, clickCountsByPostId, profileClickCount);
    const kpiResult = await retry(() => sheetsClient.replaceKpiRows(kpiRows), {
      attempts: 3,
      initialDelayMs: 1000,
      onRetry: async (attempt, error, nextDelayMs) => {
        logger.warn("spreadsheet sync retry scheduled", {
          stage: "kpi",
          attempt,
          nextDelayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          postId: post.postId,
        });
      },
    });

    const syncedPost = await postRepository.updateSpreadsheetSync(post.postId, {
      spreadsheetSyncStatus: "synced",
      spreadsheetSyncAttempts: post.spreadsheetSyncAttempts + 1,
      spreadsheetLastSyncedAt: attemptedAt.toISOString(),
      spreadsheetNextRetryAt: null,
      spreadsheetSyncError: null,
    });

    logger.info("spreadsheet sync completed", {
      postId: post.postId,
      postManagementMode: currentRow ? "updated" : "skipped",
      postManagementRowCount: postManagementResult.rowCount,
      analysisRowCount: analysisResult.rowCount,
      kpiRowCount: kpiResult.rowCount,
      ideaBacklogRowCount: ideaBacklogResult.rowCount,
      spreadsheetSyncAttempts: syncedPost?.spreadsheetSyncAttempts ?? null,
      durationMs: Date.now() - startedAt,
    });

    return {
      correlationId,
      configured: sheetsClient.isConfigured(),
      postManagement: {
        mode: currentRow ? "updated" : "skipped",
        row: currentRow,
        rowCount: postManagementResult.rowCount,
      },
      analysis: {
        rowCount: analysisResult.rowCount,
        rows: analysisRows,
      },
      kpi: {
        rowCount: kpiResult.rowCount,
        rows: kpiRows,
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
