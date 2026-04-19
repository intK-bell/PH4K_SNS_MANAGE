export interface AppEnv {
  awsRegion: string;
  deployStage: string;
  ideasTableName: string;
  candidatesTableName: string;
  postsTableName: string;
  metricsTableName: string;
  clicksTableName: string;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  lineUserId: string;
  xAppBaseUrl: string;
  metricFetchSchedulerGroupName: string;
  metricFetchLambdaArn: string;
  schedulerExecutionRoleArn: string;
  googleServiceAccountEmail: string;
  googleServiceAccountPrivateKey: string;
  googleSpreadsheetId: string;
  candidateDeliveryStateMachineArn: string;
  postPublishStateMachineArn: string;
  pushCandidatesToLineLambdaArn: string;
  syncToSpreadsheetLambdaArn: string;
  xApiKey: string;
  xApiKeySecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  xBearerToken: string;
  openAiApiKey: string;
  openAiModel: string;
  openAiPromptVersion: string;
  lpLandingUrl: string;
  clickTrackingBaseUrl: string;
  staleCandidateRetentionDays: number;
  enableXPublish: boolean;
  logLevel: string;
}

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/$/, "");

const resolveUrlOrigin = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  try {
    return normalizeBaseUrl(new URL(trimmed).origin);
  } catch {
    return "";
  }
};

const resolveClickTrackingBaseUrl = (): string => {
  const explicitBaseUrl = process.env.CLICK_TRACKING_BASE_URL ?? "";
  if (explicitBaseUrl.trim() !== "") {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  if (appBaseUrl.trim() !== "") {
    return normalizeBaseUrl(appBaseUrl);
  }

  const landingUrlOrigin = resolveUrlOrigin(process.env.LP_LANDING_URL ?? "");
  if (landingUrlOrigin !== "") {
    return landingUrlOrigin;
  }

  return "";
};

export const loadEnv = (): AppEnv => ({
  awsRegion: process.env.AWS_REGION ?? "ap-northeast-1",
  deployStage: process.env.DEPLOY_STAGE ?? "dev",
  ideasTableName: process.env.IDEAS_TABLE_NAME ?? "ideas-dev",
  candidatesTableName: process.env.CANDIDATES_TABLE_NAME ?? "candidates-dev",
  postsTableName: process.env.POSTS_TABLE_NAME ?? "posts-dev",
  metricsTableName: process.env.METRICS_TABLE_NAME ?? "metrics-dev",
  clicksTableName: process.env.CLICKS_TABLE_NAME ?? "clicks-dev",
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
  lineUserId: process.env.LINE_USER_ID ?? "",
  xAppBaseUrl: process.env.APP_BASE_URL ?? "https://x.com",
  metricFetchSchedulerGroupName: process.env.METRIC_FETCH_SCHEDULER_GROUP_NAME ?? "default",
  metricFetchLambdaArn: process.env.FETCH_POST_METRICS_LAMBDA_ARN ?? "",
  schedulerExecutionRoleArn: process.env.SCHEDULER_EXECUTION_ROLE_ARN ?? "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  googleServiceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "",
  googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID ?? "",
  candidateDeliveryStateMachineArn: process.env.CANDIDATE_DELIVERY_STATE_MACHINE_ARN ?? "",
  postPublishStateMachineArn: process.env.POST_PUBLISH_STATE_MACHINE_ARN ?? "",
  pushCandidatesToLineLambdaArn: process.env.PUSH_CANDIDATES_TO_LINE_LAMBDA_ARN ?? "",
  syncToSpreadsheetLambdaArn: process.env.SYNC_TO_SPREADSHEET_LAMBDA_ARN ?? "",
  xApiKey: process.env.X_API_KEY ?? "",
  xApiKeySecret: process.env.X_API_KEY_SECRET ?? "",
  xAccessToken: process.env.X_ACCESS_TOKEN ?? "",
  xAccessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET ?? "",
  xBearerToken: process.env.X_BEARER_TOKEN ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  openAiPromptVersion: process.env.OPENAI_PROMPT_VERSION ?? "v1",
  lpLandingUrl:
    process.env.LP_LANDING_URL ?? "https://ph4k.aokigk.com/landing",
  clickTrackingBaseUrl: resolveClickTrackingBaseUrl(),
  staleCandidateRetentionDays: Number.parseInt(
    process.env.STALE_CANDIDATE_RETENTION_DAYS ?? "7",
    10,
  ),
  enableXPublish: process.env.ENABLE_X_PUBLISH !== "false",
  logLevel: process.env.LOG_LEVEL ?? "info",
});
