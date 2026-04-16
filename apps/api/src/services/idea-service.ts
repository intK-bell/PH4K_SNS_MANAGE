import type { CreateIdeaInput, UpdateIdeaInput } from "@ph4k/core";
import { DynamoIdeaRepository } from "@ph4k/infra";
import { HttpError } from "../lib/http.js";

export class IdeaService {
  constructor(private readonly repository: DynamoIdeaRepository) {}

  listIdeas() {
    return this.repository.listIdeas();
  }

  async getIdea(ideaId: string) {
    const idea = await this.repository.getIdea(ideaId);
    if (!idea) {
      throw new HttpError(404, "idea not found");
    }
    return idea;
  }

  createIdea(input: CreateIdeaInput) {
    return this.repository.createIdea(input);
  }

  async updateIdea(ideaId: string, input: UpdateIdeaInput) {
    const updated = await this.repository.updateIdea(ideaId, input);
    if (!updated) {
      throw new HttpError(404, "idea not found");
    }
    return updated;
  }
}
