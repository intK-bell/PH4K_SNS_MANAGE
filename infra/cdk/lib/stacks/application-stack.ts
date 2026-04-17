import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import type { Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import {
  CfnStateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
import type { Construct } from "constructs";

interface ApplicationStackProps extends StackProps {
  ideasTable: Table;
  candidatesTable: Table;
  postsTable: Table;
  metricsTable: Table;
}

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const projectRoot = join(process.cwd(), "..", "..");
    const commonNodejsBundling = {
      minify: false,
      sourceMap: false,
      target: "node22",
      format: OutputFormat.CJS,
    };
    const metricFetchScheduleGroup = new CfnScheduleGroup(this, "MetricFetchScheduleGroup", {
      name: "metric-fetch",
    });

    const schedulerGroupArn = [
      "arn",
      Stack.of(this).partition,
      "scheduler",
      Stack.of(this).region,
      Stack.of(this).account,
      `schedule-group/${metricFetchScheduleGroup.name}`,
    ].join(":");

    const schedulerScheduleArnPattern = [
      "arn",
      Stack.of(this).partition,
      "scheduler",
      Stack.of(this).region,
      Stack.of(this).account,
      `schedule/${metricFetchScheduleGroup.name}/*`,
    ].join(":");

    const apiHandler = new NodejsFunction(this, "IdeasApiHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "api", "src", "index.ts"),
      handler: "handler",
      timeout: Duration.seconds(15),
      bundling: commonNodejsBundling,
      environment: {
        IDEAS_TABLE_NAME: props.ideasTable.tableName,
        CANDIDATES_TABLE_NAME: props.candidatesTable.tableName,
        POSTS_TABLE_NAME: props.postsTable.tableName,
        LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
        LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET ?? "",
        LINE_USER_ID: process.env.LINE_USER_ID ?? "",
        ENABLE_X_PUBLISH: process.env.ENABLE_X_PUBLISH ?? "true",
        CANDIDATE_DELIVERY_STATE_MACHINE_ARN: "",
        POST_PUBLISH_STATE_MACHINE_ARN: "",
        PUSH_CANDIDATES_TO_LINE_LAMBDA_ARN: "",
        SYNC_TO_SPREADSHEET_LAMBDA_ARN: "",
      },
    });

    const generateCandidatesHandler = new NodejsFunction(this, "GenerateCandidatesHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "generateCandidates.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        IDEAS_TABLE_NAME: props.ideasTable.tableName,
        CANDIDATES_TABLE_NAME: props.candidatesTable.tableName,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
        OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        OPENAI_PROMPT_VERSION: process.env.OPENAI_PROMPT_VERSION ?? "v1",
        LP_LANDING_URL: process.env.LP_LANDING_URL ?? "",
      },
    });

    const pushCandidatesToLineHandler = new NodejsFunction(this, "PushCandidatesToLineHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "pushCandidatesToLine.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        CANDIDATES_TABLE_NAME: props.candidatesTable.tableName,
        LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
        LINE_USER_ID: process.env.LINE_USER_ID ?? "",
      },
    });

    const publishSelectedPostHandler = new NodejsFunction(this, "PublishSelectedPostHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "publishSelectedPost.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        CANDIDATES_TABLE_NAME: props.candidatesTable.tableName,
        POSTS_TABLE_NAME: props.postsTable.tableName,
        X_API_KEY: process.env.X_API_KEY ?? "",
        X_API_KEY_SECRET: process.env.X_API_KEY_SECRET ?? "",
        X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN ?? "",
        X_ACCESS_TOKEN_SECRET: process.env.X_ACCESS_TOKEN_SECRET ?? "",
        X_BEARER_TOKEN: process.env.X_BEARER_TOKEN ?? "",
        APP_BASE_URL: process.env.APP_BASE_URL ?? "",
        LP_LANDING_URL: process.env.LP_LANDING_URL ?? "",
      },
    });

    const fetchPostMetricsHandler = new NodejsFunction(this, "FetchPostMetricsHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "fetchPostMetrics.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        POSTS_TABLE_NAME: props.postsTable.tableName,
        METRICS_TABLE_NAME: props.metricsTable.tableName,
        X_BEARER_TOKEN: process.env.X_BEARER_TOKEN ?? "",
        X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN ?? "",
      },
    });

    const syncToSpreadsheetHandler = new NodejsFunction(this, "SyncToSpreadsheetHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "syncToSpreadsheet.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        POSTS_TABLE_NAME: props.postsTable.tableName,
        METRICS_TABLE_NAME: props.metricsTable.tableName,
        IDEAS_TABLE_NAME: props.ideasTable.tableName,
        CANDIDATES_TABLE_NAME: props.candidatesTable.tableName,
        GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "",
        GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID ?? "",
      },
    });

    const schedulerExecutionRole = new Role(this, "SchedulerExecutionRole", {
      assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    });

    schedulerExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [fetchPostMetricsHandler.functionArn],
      }),
    );

    const createMetricFetchScheduleHandler = new NodejsFunction(this, "CreateMetricFetchScheduleHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: join(projectRoot, "apps", "workers", "src", "handlers", "createMetricFetchSchedule.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      bundling: commonNodejsBundling,
      environment: {
        POSTS_TABLE_NAME: props.postsTable.tableName,
        METRIC_FETCH_SCHEDULER_GROUP_NAME: metricFetchScheduleGroup.name ?? "metric-fetch",
        FETCH_POST_METRICS_LAMBDA_ARN: fetchPostMetricsHandler.functionArn,
        SCHEDULER_EXECUTION_ROLE_ARN: schedulerExecutionRole.roleArn,
      },
    });

    props.ideasTable.grantReadWriteData(apiHandler);
    props.candidatesTable.grantReadWriteData(apiHandler);
    props.postsTable.grantReadWriteData(apiHandler);
    props.ideasTable.grantReadWriteData(generateCandidatesHandler);
    props.candidatesTable.grantReadWriteData(generateCandidatesHandler);
    props.candidatesTable.grantReadWriteData(pushCandidatesToLineHandler);
    props.candidatesTable.grantReadWriteData(publishSelectedPostHandler);
    props.postsTable.grantReadWriteData(publishSelectedPostHandler);
    props.postsTable.grantReadWriteData(fetchPostMetricsHandler);
    props.metricsTable.grantReadWriteData(fetchPostMetricsHandler);
    props.postsTable.grantReadWriteData(syncToSpreadsheetHandler);
    props.metricsTable.grantReadWriteData(syncToSpreadsheetHandler);
    props.candidatesTable.grantReadData(syncToSpreadsheetHandler);
    props.ideasTable.grantReadData(syncToSpreadsheetHandler);
    props.postsTable.grantReadWriteData(createMetricFetchScheduleHandler);
    createMetricFetchScheduleHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
        ],
        resources: [schedulerGroupArn, schedulerScheduleArnPattern],
      }),
    );
    createMetricFetchScheduleHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["iam:PassRole"],
        resources: [schedulerExecutionRole.roleArn],
        conditions: {
          StringEquals: {
            "iam:PassedToService": "scheduler.amazonaws.com",
          },
        },
      }),
    );

    const api = new LambdaRestApi(this, "IdeasApi", {
      handler: apiHandler,
      proxy: true,
    });

    const stateMachineRole = new Role(this, "StateMachineRole", {
      assumedBy: new ServicePrincipal("states.amazonaws.com"),
    });

    stateMachineRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [
          generateCandidatesHandler.functionArn,
          pushCandidatesToLineHandler.functionArn,
          publishSelectedPostHandler.functionArn,
          createMetricFetchScheduleHandler.functionArn,
          fetchPostMetricsHandler.functionArn,
          syncToSpreadsheetHandler.functionArn,
        ],
      }),
    );

    const candidateDeliveryDefinition = readFileSync(
      join(process.cwd(), "..", "stepfunctions", "candidate-delivery.asl.json"),
      "utf-8",
    )
      .replace("${GenerateCandidatesLambdaArn}", generateCandidatesHandler.functionArn)
      .replace("${PushCandidatesToLineLambdaArn}", pushCandidatesToLineHandler.functionArn);

    const postPublishDefinition = readFileSync(
      join(process.cwd(), "..", "stepfunctions", "post-publish.asl.json"),
      "utf-8",
    )
      .replace("${PublishSelectedPostLambdaArn}", publishSelectedPostHandler.functionArn)
      .replace("${CreateMetricFetchScheduleLambdaArn}", createMetricFetchScheduleHandler.functionArn);

    const metricSyncDefinition = readFileSync(
      join(process.cwd(), "..", "stepfunctions", "metric-sync.asl.json"),
      "utf-8",
    )
      .replace("${FetchPostMetricsLambdaArn}", fetchPostMetricsHandler.functionArn)
      .replace("${SyncToSpreadsheetLambdaArn}", syncToSpreadsheetHandler.functionArn);

    const candidateDeliveryStateMachine = new CfnStateMachine(this, "CandidateDeliveryStateMachine", {
      roleArn: stateMachineRole.roleArn,
      definitionString: candidateDeliveryDefinition,
      stateMachineName: "candidate-delivery",
    });

    const postPublishStateMachine = new CfnStateMachine(this, "PostPublishStateMachine", {
      roleArn: stateMachineRole.roleArn,
      definitionString: postPublishDefinition,
      stateMachineName: "post-publish",
    });

    new CfnStateMachine(this, "MetricSyncStateMachine", {
      roleArn: stateMachineRole.roleArn,
      definitionString: metricSyncDefinition,
      stateMachineName: "metric-sync",
    });

    apiHandler.addEnvironment(
      "CANDIDATE_DELIVERY_STATE_MACHINE_ARN",
      candidateDeliveryStateMachine.attrArn,
    );
    apiHandler.addEnvironment("POST_PUBLISH_STATE_MACHINE_ARN", postPublishStateMachine.attrArn);
    apiHandler.addEnvironment("PUSH_CANDIDATES_TO_LINE_LAMBDA_ARN", pushCandidatesToLineHandler.functionArn);
    apiHandler.addEnvironment("SYNC_TO_SPREADSHEET_LAMBDA_ARN", syncToSpreadsheetHandler.functionArn);
    apiHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["states:StartExecution"],
        resources: [
          candidateDeliveryStateMachine.attrArn,
          postPublishStateMachine.attrArn,
        ],
      }),
    );
    apiHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [
          pushCandidatesToLineHandler.functionArn,
          syncToSpreadsheetHandler.functionArn,
        ],
      }),
    );

    new CfnOutput(this, "ApiGatewayBaseUrl", {
      value: api.url,
      description: "Base URL for the API Gateway endpoint",
    });

    new CfnOutput(this, "LineWebhookUrl", {
      value: `${api.url}webhooks/line`,
      description: "Webhook URL to configure in LINE Messaging API",
    });
  }
}
