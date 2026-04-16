import { loadEnv } from "@ph4k/config";
import {
  createDynamoDocumentClient,
  createMetricFetchScheduler,
  DynamoPostRepository,
} from "@ph4k/infra";
import { validateCreateMetricFetchScheduleInput } from "../lib/create-metric-fetch-schedule-validation.js";

const env = loadEnv();
const schedulerEnabled =
  env.metricFetchLambdaArn !== "" && env.schedulerExecutionRoleArn !== "";
const scheduler = createMetricFetchScheduler(env.awsRegion, schedulerEnabled);
const client = createDynamoDocumentClient(env.awsRegion);
const postRepository = new DynamoPostRepository(client, env.postsTableName);

export const handler = async (event: unknown) => {
  const input = validateCreateMetricFetchScheduleInput(event);
  const post = await postRepository.getPost(input.postId);

  if (!post) {
    throw new Error("post not found");
  }

  const plans = await scheduler.createSchedules({
    postId: input.postId,
    baseTime: post.postedAt ?? new Date().toISOString(),
    targetLambdaArn: env.metricFetchLambdaArn,
    roleArn: env.schedulerExecutionRoleArn,
    groupName: env.metricFetchSchedulerGroupName,
    offsetsInHours: [1, 24, 72],
  });

  return {
    postId: input.postId,
    schedulerEnabled,
    schedules: plans,
  };
};
