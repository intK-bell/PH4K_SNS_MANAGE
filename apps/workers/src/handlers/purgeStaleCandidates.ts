import { randomUUID } from "node:crypto";
import { loadEnv } from "@ph4k/config";
import {
  createDynamoDocumentClient,
  createLogger,
  DynamoCandidateRepository,
} from "@ph4k/infra";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isPurgeTarget = (
  candidate: Awaited<ReturnType<typeof candidateRepository.listCandidates>>[number],
  cutoffTime: number,
): boolean => {
  if (candidate.selected) {
    return false;
  }
  if (candidate.status === "posted") {
    return false;
  }

  const updatedAt = new Date(candidate.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return updatedAt < cutoffTime;
};

export const handler = async () => {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const logger = createLogger({
    correlationId,
    component: "workers.purgeStaleCandidates",
    operation: "purge_stale_candidates",
  });

  const now = Date.now();
  const retentionDays = Number.isNaN(env.staleCandidateRetentionDays)
    ? 7
    : env.staleCandidateRetentionDays;
  const cutoffTime = now - retentionDays * MS_PER_DAY;

  logger.info("stale candidate purge started", {
    retentionDays,
    cutoffIso: new Date(cutoffTime).toISOString(),
  });

  const candidates = await candidateRepository.listCandidates();
  const targets = candidates.filter((candidate) => isPurgeTarget(candidate, cutoffTime));

  for (const candidate of targets) {
    await candidateRepository.deleteCandidate(candidate.candidateId);
  }

  logger.info("stale candidate purge completed", {
    retentionDays,
    scannedCount: candidates.length,
    deletedCount: targets.length,
    deletedCandidateIds: targets.map((candidate) => candidate.candidateId),
    durationMs: Date.now() - startedAt,
  });

  return {
    correlationId,
    retentionDays,
    scannedCount: candidates.length,
    deletedCount: targets.length,
    deletedCandidateIds: targets.map((candidate) => candidate.candidateId),
  };
};
