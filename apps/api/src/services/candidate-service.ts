import type { UpdateCandidateInput } from "@ph4k/core";
import { DynamoCandidateRepository } from "@ph4k/infra";
import { HttpError } from "../lib/http.js";

export class CandidateService {
  constructor(private readonly repository: DynamoCandidateRepository) {}

  listCandidates() {
    return this.repository.listCandidates();
  }

  async updateCandidate(candidateId: string, input: UpdateCandidateInput) {
    const updated = await this.repository.updateCandidate(candidateId, input);
    if (!updated) {
      throw new HttpError(404, "candidate not found");
    }
    return updated;
  }
}
