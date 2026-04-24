export const POST_TYPES = [
  "awareness",
  "overtime",
  "before_after",
  "double_question",
  "light_achievement",
  "cta",
  "constraint",
  "current_affairs",
  "viral",
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const SALES_POST_TYPES: PostType[] = [
  "awareness",
  "overtime",
  "before_after",
  "double_question",
  "light_achievement",
  "cta",
  "constraint",
  "current_affairs",
];

export const VIRAL_POST_TYPES: PostType[] = ["viral"];
