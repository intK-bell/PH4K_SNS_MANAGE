import type { PostType } from "../constants/post-types.js";

export interface DailyPostingPlan {
  date: string;
  totalRequiredPosts: number;
  salesRequiredPosts: number;
  viralRequiredPosts: number;
  postedSalesCount: number;
  postedViralCount: number;
  remainingSalesSlots: number;
  remainingViralSlots: number;
  suggestedTypes: PostType[];
}
