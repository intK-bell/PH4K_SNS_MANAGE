import type { GenerateCandidatesInput } from "../schemas/idea-payloads.js";

export interface ClickTrackingLink {
  shortId: string;
  postId: string;
  candidateId: string;
  type: GenerateCandidatesInput["type"];
  mode: "seed" | "harvest";
  landingUrl: string;
  createdAt: string;
}
