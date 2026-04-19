import { randomUUID } from "node:crypto";
import {
  buildPublishPostText,
  buildTrackingUrl,
  createTrackingShortId,
  XPublisherClient,
} from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import {
  createDynamoDocumentClient,
  DynamoCandidateRepository,
  DynamoClickTrackingRepository,
  DynamoPostRepository,
} from "@ph4k/infra";
import { validatePublishSelectedPostInput } from "../lib/publish-selected-post-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);
const postRepository = new DynamoPostRepository(client, env.postsTableName);
const clickTrackingRepository = new DynamoClickTrackingRepository(client, env.clicksTableName);
const publisher = new XPublisherClient({
  apiKey: env.xApiKey,
  apiKeySecret: env.xApiKeySecret,
  accessToken: env.xAccessToken,
  accessTokenSecret: env.xAccessTokenSecret,
  bearerToken: env.xBearerToken,
  publicBaseUrl: env.xAppBaseUrl,
});

export const handler = async (event: unknown) => {
  const input = validatePublishSelectedPostInput(event);
  const candidate = await candidateRepository.getCandidate(input.candidateId);

  if (!candidate) {
    throw new Error("candidate not found");
  }

  const postId = randomUUID();
  const shortId = createTrackingShortId();
  const trackingUrl = buildTrackingUrl(
    env.clickTrackingBaseUrl,
    shortId,
    env.lpLandingUrl,
  );

  const published = await publisher.publish({
    text: buildPublishPostText(candidate.hook, candidate.body, trackingUrl),
    candidateId: candidate.candidateId,
  });

  const post = await postRepository.createPost({
    postId,
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

  await clickTrackingRepository.createLink({
    shortId,
    postId,
    candidateId: candidate.candidateId,
    type: candidate.type,
    mode: candidate.type === "viral" ? "harvest" : "seed",
    landingUrl: env.lpLandingUrl.trim(),
    createdAt: new Date().toISOString(),
  });

  const updatedCandidate = await candidateRepository.updateCandidate(candidate.candidateId, {
    selected: true,
    status: "posted",
    trackingShortId: shortId,
  });

  return {
    candidate: updatedCandidate,
    post,
  };
};
