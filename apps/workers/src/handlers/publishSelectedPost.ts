import { XPublisherClient } from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import {
  createDynamoDocumentClient,
  DynamoCandidateRepository,
  DynamoPostRepository,
} from "@ph4k/infra";
import { validatePublishSelectedPostInput } from "../lib/publish-selected-post-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);
const postRepository = new DynamoPostRepository(client, env.postsTableName);
const publisher = new XPublisherClient({
  apiKey: env.xApiKey,
  apiKeySecret: env.xApiKeySecret,
  accessToken: env.xAccessToken,
  accessTokenSecret: env.xAccessTokenSecret,
  bearerToken: env.xBearerToken,
  publicBaseUrl: env.xAppBaseUrl,
});

const buildPostText = (hook: string, body: string, lpLandingUrl: string): string => {
  const trimmedHook = hook.trim();
  const trimmedBody = body.trim();
  const trimmedUrl = lpLandingUrl.trim();

  if (trimmedUrl === "") {
    return `${trimmedHook}\n${trimmedBody}`.trim();
  }

  const normalizedBody = trimmedBody.includes(trimmedUrl)
    ? trimmedBody
    : `${trimmedBody}\n\n詳細はこちら\n${trimmedUrl}`.trim();

  return `${trimmedHook}\n${normalizedBody}`.trim();
};

export const handler = async (event: unknown) => {
  const input = validatePublishSelectedPostInput(event);
  const candidate = await candidateRepository.getCandidate(input.candidateId);

  if (!candidate) {
    throw new Error("candidate not found");
  }

  const published = await publisher.publish({
    text: buildPostText(candidate.hook, candidate.body, env.lpLandingUrl),
    candidateId: candidate.candidateId,
  });

  const updatedCandidate = await candidateRepository.updateCandidate(candidate.candidateId, {
    selected: true,
    status: "posted",
  });

  const post = await postRepository.createPost({
    candidateId: candidate.candidateId,
    ideaId: candidate.ideaId,
    snsType: "x",
    externalPostId: published.externalPostId,
    postUrl: published.postUrl,
    postedAt: published.postedAt,
    status: "posted",
    latestImpressions: null,
    latestLikes: null,
    latestReplies: null,
    latestReposts: null,
    latestBookmarks: null,
    spreadsheetSyncStatus: "pending",
    spreadsheetSyncAttempts: 0,
    spreadsheetLastSyncedAt: null,
    spreadsheetNextRetryAt: null,
    spreadsheetSyncError: null,
  });

  return {
    candidate: updatedCandidate,
    post,
  };
};
