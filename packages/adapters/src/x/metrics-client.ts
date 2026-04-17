import type { MetricSnapshot, Post } from "@ph4k/core";

interface XMetricsAuthConfig {
  bearerToken: string;
  accessToken: string;
}

export class XMetricsClient {
  constructor(
    private readonly config: XMetricsAuthConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchMetrics(post: Post, offsetHours?: number): Promise<Omit<MetricSnapshot, "postId" | "fetchedAt">> {
    const targetId = post.externalPostId ?? post.postId;
    const authorizationHeader = this.config.bearerToken
      ? `Bearer ${this.config.bearerToken}`
      : this.config.accessToken
        ? `Bearer ${this.config.accessToken}`
        : "";

    if (!authorizationHeader) {
      throw new Error("x metrics credentials are not configured");
    }

    const response = await this.fetchImpl(
      `https://api.x.com/2/tweets/${targetId}?tweet.fields=public_metrics`,
      {
        method: "GET",
        headers: {
          authorization: authorizationHeader,
        },
      },
    );

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
      quoteCount: metrics.quote_count ?? 0,
    };
  }
}
