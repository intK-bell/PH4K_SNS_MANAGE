import type {
  FailedJobsResponse,
  FailedLinePushJob,
  FailedSpreadsheetSyncJob,
} from "@ph4k/core";
import { DynamoCandidateRepository, DynamoPostRepository } from "@ph4k/infra";

const compareFailureTimestamps = (
  leftNextRetryAt: string | null,
  leftUpdatedAt: string,
  rightNextRetryAt: string | null,
  rightUpdatedAt: string,
): number => {
  const leftPrimary = leftNextRetryAt ?? leftUpdatedAt;
  const rightPrimary = rightNextRetryAt ?? rightUpdatedAt;
  return rightPrimary.localeCompare(leftPrimary);
};

export class FailedJobService {
  constructor(
    private readonly candidateRepository: DynamoCandidateRepository,
    private readonly postRepository: DynamoPostRepository,
  ) {}

  async listFailedJobs(): Promise<FailedJobsResponse> {
    const [candidates, posts] = await Promise.all([
      this.candidateRepository.listFailedCandidates(),
      this.postRepository.listFailedSpreadsheetSyncPosts(),
    ]);

    const linePushJobs: FailedLinePushJob[] = candidates
      .sort((left, right) =>
        compareFailureTimestamps(
          left.lineNextRetryAt,
          left.updatedAt,
          right.lineNextRetryAt,
          right.updatedAt,
        ),
      )
      .map((candidate) => ({
        jobType: "line_push",
        candidateId: candidate.candidateId,
        ideaId: candidate.ideaId,
        candidateStatus: candidate.status,
        lineDeliveryStatus: "failed",
        lineDeliveryAttempts: candidate.lineDeliveryAttempts,
        lineLastAttemptAt: candidate.lineLastAttemptAt,
        lineNextRetryAt: candidate.lineNextRetryAt,
        lineLastError: candidate.lineLastError,
        updatedAt: candidate.updatedAt,
      }));

    const spreadsheetSyncJobs: FailedSpreadsheetSyncJob[] = posts
      .sort((left, right) =>
        compareFailureTimestamps(
          left.spreadsheetNextRetryAt,
          left.updatedAt,
          right.spreadsheetNextRetryAt,
          right.updatedAt,
        ),
      )
      .map((post) => ({
        jobType: "spreadsheet_sync",
        postId: post.postId,
        candidateId: post.candidateId,
        ideaId: post.ideaId,
        postStatus: post.status,
        spreadsheetSyncStatus: "failed",
        spreadsheetSyncAttempts: post.spreadsheetSyncAttempts,
        spreadsheetLastSyncedAt: post.spreadsheetLastSyncedAt,
        spreadsheetNextRetryAt: post.spreadsheetNextRetryAt,
        spreadsheetSyncError: post.spreadsheetSyncError,
        updatedAt: post.updatedAt,
      }));

    return {
      summary: {
        total: linePushJobs.length + spreadsheetSyncJobs.length,
        linePush: linePushJobs.length,
        spreadsheetSync: spreadsheetSyncJobs.length,
      },
      linePushJobs,
      spreadsheetSyncJobs,
    };
  }
}
