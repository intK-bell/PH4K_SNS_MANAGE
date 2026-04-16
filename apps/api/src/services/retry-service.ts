import { HttpError } from "../lib/http.js";
import { DynamoCandidateRepository, DynamoPostRepository, WorkerInvoker } from "@ph4k/infra";

export class RetryService {
  constructor(
    private readonly candidateRepository: DynamoCandidateRepository,
    private readonly postRepository: DynamoPostRepository,
    private readonly workerInvoker: WorkerInvoker,
  ) {}

  async retryLinePush(candidateId: string) {
    const candidate = await this.candidateRepository.getCandidate(candidateId);
    if (!candidate) {
      throw new HttpError(404, "candidate not found");
    }

    if (candidate.lineDeliveryStatus !== "failed") {
      throw new HttpError(409, "candidate line delivery is not in failed state");
    }

    return this.workerInvoker.retryLinePush(candidateId);
  }

  async retrySpreadsheetSync(postId: string) {
    const post = await this.postRepository.getPost(postId);
    if (!post) {
      throw new HttpError(404, "post not found");
    }

    if (post.spreadsheetSyncStatus !== "failed") {
      throw new HttpError(409, "post spreadsheet sync is not in failed state");
    }

    return this.workerInvoker.retrySpreadsheetSync(postId);
  }
}
