import { createHmac, randomBytes } from "node:crypto";
import type { MetricSnapshot, Post } from "@ph4k/core";

interface XMetricsAuthConfig {
  apiKey: string;
  apiKeySecret: string;
  accessTokenSecret: string;
  bearerToken: string;
  accessToken: string;
}

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
  config: XMetricsAuthConfig,
): string => {
  const parsedUrl = new URL(url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };
  const signatureParams: Record<string, string> = { ...oauthParams };
  parsedUrl.searchParams.forEach((value, key) => {
    signatureParams[key] = value;
  });

  const signatureBaseString = [
    method.toUpperCase(),
    encode(`${parsedUrl.origin}${parsedUrl.pathname}`),
    encode(buildQueryString(signatureParams)),
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

export class XMetricsClient {
  constructor(
    private readonly config: XMetricsAuthConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchMetrics(post: Post, offsetHours?: number): Promise<Omit<MetricSnapshot, "postId" | "fetchedAt">> {
    const targetId = post.externalPostId ?? post.postId;
    const endpoint = `https://api.x.com/2/tweets/${targetId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`;
    let authorizationHeader = "";

    if (
      this.config.apiKey &&
      this.config.apiKeySecret &&
      this.config.accessToken &&
      this.config.accessTokenSecret
    ) {
      authorizationHeader = buildOauthHeader("GET", endpoint, this.config);
    } else if (this.config.bearerToken) {
      authorizationHeader = `Bearer ${this.config.bearerToken}`;
    } else if (this.config.accessToken) {
      authorizationHeader = `Bearer ${this.config.accessToken}`;
    }

    if (!authorizationHeader) {
      throw new Error("x metrics credentials are not configured");
    }

    const response = await this.fetchImpl(endpoint, {
      method: "GET",
      headers: {
        authorization: authorizationHeader,
      },
    });

    const payload = (await response.json()) as {
      data?: {
        public_metrics?: {
          retweet_count?: number;
          reply_count?: number;
          like_count?: number;
          quote_count?: number;
          bookmark_count?: number;
          impression_count?: number;
        };
        non_public_metrics?: {
          url_link_clicks?: number;
        };
        organic_metrics?: {
          url_link_clicks?: number;
        };
      };
      errors?: Array<{ detail?: string; title?: string }>;
    };

    if (!response.ok || !payload.data?.public_metrics) {
      const detail = payload.errors?.[0]?.detail ?? payload.errors?.[0]?.title ?? "unknown x metrics error";
      throw new Error(`x metrics fetch failed: ${detail}`);
    }

    const metrics = payload.data.public_metrics;
    return {
      impressions: metrics.impression_count ?? 0,
      likes: metrics.like_count ?? 0,
      replies: metrics.reply_count ?? 0,
      reposts: metrics.retweet_count ?? 0,
      bookmarks: metrics.bookmark_count ?? 0,
      urlLinkClicks:
        payload.data.organic_metrics?.url_link_clicks ??
        payload.data.non_public_metrics?.url_link_clicks ??
        0,
      quoteCount: metrics.quote_count ?? 0,
    };
  }
}
