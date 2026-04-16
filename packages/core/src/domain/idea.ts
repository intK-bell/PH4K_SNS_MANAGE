import type { IdeaStatus } from "../constants/statuses.js";

export interface Idea {
  ideaId: string;
  title: string;
  problem: string;
  detail: string;
  priority: number;
  tags: string[];
  status: IdeaStatus;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}
