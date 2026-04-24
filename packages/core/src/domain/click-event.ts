export interface ClickEvent {
  shortId: string;
  postId: string;
  channel?: "x";
  surface?: "post" | "profile";
  clickedAt: string;
  userAgent: string | null;
  referer: string | null;
  ipAddress: string | null;
}
