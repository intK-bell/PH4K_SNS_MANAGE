import {
  InvokeCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

const decodePayload = (payload?: Uint8Array): unknown => {
  if (!payload || payload.length === 0) {
    return null;
  }

  const text = Buffer.from(payload).toString("utf-8");
  if (text.trim() === "") {
    return null;
  }

  return JSON.parse(text);
};

export class WorkerInvoker {
  constructor(
    private readonly client: LambdaClient,
    private readonly pushCandidatesToLineLambdaArn: string,
    private readonly syncToSpreadsheetLambdaArn: string,
  ) {}

  private async invoke(functionName: string, payload: unknown) {
    if (!functionName.trim()) {
      return {
        mode: "planned" as const,
        payload,
      };
    }

    const result = await this.client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(payload)),
      }),
    );

    if (result.FunctionError) {
      throw new Error(
        `lambda invoke failed: ${result.FunctionError} ${JSON.stringify(decodePayload(result.Payload))}`,
      );
    }

    return {
      mode: "invoked" as const,
      payload: decodePayload(result.Payload),
      statusCode: result.StatusCode ?? null,
    };
  }

  retryLinePush(candidateId: string) {
    return this.invoke(this.pushCandidatesToLineLambdaArn, {
      candidateIds: [candidateId],
    });
  }

  retrySpreadsheetSync(postId: string) {
    return this.invoke(this.syncToSpreadsheetLambdaArn, {
      postId,
    });
  }
}

export const createWorkerInvoker = (
  region: string,
  pushCandidatesToLineLambdaArn: string,
  syncToSpreadsheetLambdaArn: string,
): WorkerInvoker =>
  new WorkerInvoker(
    new LambdaClient({ region }),
    pushCandidatesToLineLambdaArn,
    syncToSpreadsheetLambdaArn,
  );
