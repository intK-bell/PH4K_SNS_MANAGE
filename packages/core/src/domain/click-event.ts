export interface ClickEvent {
  shortId: string;
  postId: string;
  clickedAt: string;
  userAgent: string | null;
  referer: string | null;
  ipAddress: string | null;
}
