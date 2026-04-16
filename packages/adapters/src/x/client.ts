import { createHmac, randomBytes } from "node:crypto";

export interface PublishPostInput {
  text: string;
  candidateId: string;
}

export interface PublishPostResult {
  externalPostId: string;
  postUrl: string;
  postedAt: string;
}

interface XAuthConfig {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
  publicBaseUrl: string;
}

const X_API_BASE_URL = "https://api.x.com/2";

const encode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27");

const buildQueryString = (params: Record<string, string>): string =>
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");

const buildOauthHeader = (
  method: string,
  url: string,
  config: XAuthConfig,
): string => {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  const signatureBaseString = [
    method.toUpperCase(),
    encode(url),
    encode(
      buildQueryString(oauthParams),
    ),
  ].join("&");

  const signingKey = `${encode(config.apiKeySecret)}&${encode(config.accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  return `OAuth ${Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(", ")}`;
};

export class XPublisherClient {
  constructor(
    private readonly config: XAuthConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(input: PublishPostInput): Promise<PublishPostResult> {
    const endpoint = `${X_API_BASE_URL}/tweets`;
    const requestBody = JSON.stringify({
      text: input.text,
    });

    let authorizationHeader = "";
    if (
      this.config.apiKey &&
      this.config.apiKeySecret &&
      this.config.accessToken &&
      this.config.accessTokenSecret
    ) {
      authorizationHeader = buildOauthHeader("POST", endpoint, this.config);
    } else if (this.config.accessToken) {
      authorizationHeader = `Bearer ${this.config.accessToken}`;
    } else if (this.config.bearerToken) {
      authorizationHeader = `Bearer ${this.config.bearerToken}`;
    } else {
      throw new Error("x publish credentials are not configured");
    }

    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: authorizationHeader,
        "content-type": "application/json",
      },
      body: requestBody,
    });

    const rawText = await response.text();
    let payload: {
      data?: {
        id?: string;
      };
      errors?: Array<{ detail?: string; title?: string }>;
      detail?: string;
      title?: string;
      raw?: string;
    } = {};

    if (rawText) {
      try {
        payload = JSON.parse(rawText) as typeof payload;
      } catch {
        payload = { raw: rawText };
      }
    }

    if (!response.ok || !payload.data?.id) {
      const detail =
        payload.errors?.[0]?.detail ??
        payload.errors?.[0]?.title ??
        payload.detail ??
        payload.title ??
        payload.raw ??
        `status ${response.status}`;
      throw new Error(`x publish failed (${response.status}): ${detail}`);
    }

    const externalPostId = payload.data.id;
    const postedAt = new Date().toISOString();
    return {
      externalPostId,
      postUrl: `${this.config.publicBaseUrl.replace(/\/$/, "")}/i/web/status/${externalPostId}`,
      postedAt,
    };
  }
}
