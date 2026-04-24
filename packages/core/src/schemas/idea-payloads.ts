export interface CreateIdeaInput {
  title: string;
  problem: string;
  detail: string;
  priority: number;
  tags: string[];
}

export interface UpdateIdeaInput {
  title?: string;
  problem?: string;
  detail?: string;
  priority?: number;
  tags?: string[];
  status?: "active" | "archived";
}

export interface GenerateCandidatesInput {
  ideaId: string;
  type:
    | "awareness"
    | "overtime"
    | "before_after"
    | "double_question"
    | "light_achievement"
    | "cta"
    | "constraint"
    | "current_affairs"
    | "viral";
  count: number;
}
