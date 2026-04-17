import { OpenAiCandidateGenerator } from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import { createDynamoDocumentClient, DynamoCandidateRepository, DynamoIdeaRepository } from "@ph4k/infra";
import { validateGenerateCandidatesInput } from "../lib/generate-candidates-validation.js";

const env = loadEnv();
const client = createDynamoDocumentClient(env.awsRegion);
const ideaRepository = new DynamoIdeaRepository(client, env.ideasTableName);
const candidateRepository = new DynamoCandidateRepository(client, env.candidatesTableName);
const generator = new OpenAiCandidateGenerator(
  env.openAiApiKey,
  env.openAiModel,
  env.openAiPromptVersion,
  env.lpLandingUrl,
);

export const handler = async (event: unknown) => {
  const input = validateGenerateCandidatesInput(event);
  const idea = await ideaRepository.getIdea(input.ideaId);

  if (!idea) {
    throw new Error("idea not found");
  }

  const drafts = await generator.generate(idea, input);
  const candidates = await candidateRepository.createCandidates(input.ideaId, drafts);

  return {
    generatedCount: candidates.length,
    items: candidates,
  };
};
