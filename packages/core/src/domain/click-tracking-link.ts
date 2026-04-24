import type { GenerateCandidatesInput } from "../schemas/idea-payloads.js";

export interface ClickTrackingLink {
  shortId: string;
  postId: string;
  candidateId: string;
  type: GenerateCandidatesInput["type"];
  mode: "seed" | "harvest";
  channel?: "x";
  surface?: "post" | "profile";
  landingUrl: string;
  createdAt: string;
}
