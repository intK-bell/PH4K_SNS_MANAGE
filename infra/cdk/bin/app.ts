import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import type { Environment } from "aws-cdk-lib";
import { ApplicationStack } from "../lib/stacks/application-stack.js";
import { DataStack } from "../lib/stacks/data-stack.js";

const dotenvPath = join(process.cwd(), "..", "..", ".env");
if (existsSync(dotenvPath)) {
  const content = readFileSync(dotenvPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");
  }
}

const app = new App();

const env: Environment = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
    }
  : {
      region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
    };

const dataStack = new DataStack(app, "Ph4kSnsDataStack", { env });

new ApplicationStack(app, "Ph4kSnsApplicationStack", {
  env,
  ideasTable: dataStack.ideasTable,
  candidatesTable: dataStack.candidatesTable,
  postsTable: dataStack.postsTable,
  metricsTable: dataStack.metricsTable,
  clicksTable: dataStack.clicksTable,
});
