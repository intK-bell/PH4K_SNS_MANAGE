import { LineMessagingClient } from "@ph4k/adapters";
import { loadEnv } from "@ph4k/config";
import {
  createWorkerInvoker,
  createWorkflowClient,
  createDynamoDocumentClient,
  DynamoCandidateRepository,
  DynamoIdeaRepository,
  DynamoPostRepository,
} from "@ph4k/infra";
import { CandidateService } from "../services/candidate-service.js";
import { FailedJobService } from "../services/failed-job-service.js";
import { IdeaService } from "../services/idea-service.js";
import { PostService } from "../services/post-service.js";
import { RetryService } from "../services/retry-service.js";
import { WebhookService } from "../services/webhook-service.js";
import { WorkflowService } from "../services/workflow-service.js";

const env = loadEnv();
const documentClient = createDynamoDocumentClient(env.awsRegion);
const ideaRepository = new DynamoIdeaRepository(documentClient, env.ideasTableName);
const candidateRepository = new DynamoCandidateRepository(documentClient, env.candidatesTableName);
const postRepository = new DynamoPostRepository(documentClient, env.postsTableName);
const lineClient = new LineMessagingClient(env.lineChannelAccessToken, env.lineChannelSecret);
const workerInvoker = createWorkerInvoker(
  env.awsRegion,
  env.pushCandidatesToLineLambdaArn,
  env.syncToSpreadsheetLambdaArn,
);
const workflowClient = createWorkflowClient(
  env.awsRegion,
  env.candidateDeliveryStateMachineArn,
  env.postPublishStateMachineArn,
);

export const ideaService = new IdeaService(ideaRepository);
export const candidateService = new CandidateService(candidateRepository);
export const postService = new PostService(postRepository);
export const failedJobService = new FailedJobService(candidateRepository, postRepository);
export const retryService = new RetryService(
  candidateRepository,
  postRepository,
  workerInvoker,
);
export const workflowService = new WorkflowService(workflowClient);
export const webhookService = new WebhookService(
  lineClient,
  candidateRepository,
  ideaRepository,
  workflowClient,
  env.enableXPublish,
);
