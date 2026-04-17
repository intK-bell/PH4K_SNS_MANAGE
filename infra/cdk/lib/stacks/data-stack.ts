import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export class DataStack extends Stack {
  readonly ideasTable: Table;
  readonly candidatesTable: Table;
  readonly postsTable: Table;
  readonly metricsTable: Table;
  readonly clicksTable: Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.ideasTable = new Table(this, "IdeasTable", {
      tableName: "ideas-dev",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.candidatesTable = new Table(this, "CandidatesTable", {
      tableName: "candidates-dev",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.candidatesTable.addGlobalSecondaryIndex({
      indexName: "lineDeliveryStatusUpdatedAtIndex",
      partitionKey: {
        name: "lineDeliveryStatus",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "updatedAt",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    this.postsTable = new Table(this, "PostsTable", {
      tableName: "posts-dev",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.postsTable.addGlobalSecondaryIndex({
      indexName: "spreadsheetSyncStatusUpdatedAtIndex",
      partitionKey: {
        name: "spreadsheetSyncStatus",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "updatedAt",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    this.metricsTable = new Table(this, "MetricsTable", {
      tableName: "metrics-dev",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.clicksTable = new Table(this, "ClicksTable", {
      tableName: "clicks-dev",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.clicksTable.addGlobalSecondaryIndex({
      indexName: "shortIdIndex",
      partitionKey: {
        name: "shortId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });
  }
}
