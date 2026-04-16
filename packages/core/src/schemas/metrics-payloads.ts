export interface FetchPostMetricsInput {
  postId: string;
  offsetHours?: number;
}

export interface SyncToSpreadsheetInput {
  postId: string;
}

export interface PostManagementRow {
  id: string;
  postedDate: string;
  type: string;
  ideaTitle: string;
  hook: string;
  body: string;
  status: string;
  impressions: string;
  likes: string;
  bookmarks: string;
  replies: string;
  likeRate: string;
  evaluation: string;
  horizontalExpansion: string;
  postUrl: string;
  memo: string;
}

export interface AnalysisRow {
  segment: string;
  type: string;
  postCount: string;
  averageImpressions: string;
  averageLikes: string;
  averageBookmarks: string;
  averageReplies: string;
  averageLikeRate: string;
  latestPostedDate: string;
  latestIdeaTitle: string;
  latestPostId: string;
}

export interface IdeaBacklogRow {
  ideaId: string;
  title: string;
  problem: string;
  detail: string;
  priority: string;
  tags: string;
  status: string;
  useCount: string;
  createdAt: string;
  updatedAt: string;
}
