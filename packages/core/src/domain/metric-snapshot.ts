export interface MetricSnapshot {
  postId: string;
  fetchedAt: string;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  quoteCount: number | null;
}
