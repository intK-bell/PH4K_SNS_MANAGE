import { LineMessagingClient } from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import { createDynamoDocumentClient, DynamoCandidateRepository } from "@ph4k/infra";
import { buildNextRetryAt, retry } from "../lib/retry.js";
import { validatePushCandidatesToLineInput } from "../lib/push-candidates-to-line-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);
const lineClient = new LineMessagingClient(env.lineChannelAccessToken, env.lineChannelSecret);

export const handler = async (event: unknown) => {
  const input = validatePushCandidatesToLineInput(event);
  const candidates = await Promise.all(
    input.candidateIds.map((candidateId) => candidateRepository.getCandidate(candidateId)),
  );

  const resolvedCandidates = candidates.filter((candidate) => candidate !== null);
  const attemptedAt = new Date();

  try {
    await retry(() => lineClient.pushCandidates(env.lineUserId, resolvedCandidates), {
      attempts: 3,
      initialDelayMs: 1000,
    });

    const updated = await Promise.all(
      resolvedCandidates.map((candidate) =>
        candidateRepository.updateCandidate(candidate.candidateId, {
          lineDeliveryStatus: "sent",
          status: "sent_to_line",
          lineDeliveryAttempts: candidate.lineDeliveryAttempts + 1,
          lineLastAttemptAt: attemptedAt.toISOString(),
          lineNextRetryAt: null,
          lineLastError: null,
        }),
      ),
    );

    return {
      deliveredCount: updated.filter(Boolean).length,
      items: updated.filter((item) => item !== null),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown line push error";
    const nextRetryAt = buildNextRetryAt(attemptedAt, 15 * 60 * 1000);

    await Promise.all(
      resolvedCandidates.map((candidate) =>
        candidateRepository.updateCandidate(candidate.candidateId, {
          lineDeliveryStatus: "failed",
          status: "error",
          lineDeliveryAttempts: candidate.lineDeliveryAttempts + 1,
          lineLastAttemptAt: attemptedAt.toISOString(),
          lineNextRetryAt: nextRetryAt,
          lineLastError: message,
        }),
      ),
    );

    throw error;
  }
};
