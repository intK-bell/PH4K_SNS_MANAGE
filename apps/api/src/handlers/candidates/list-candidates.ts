import { candidateService } from "../../lib/container.js";
import { json } from "../../lib/http.js";

export const listCandidates = async () => {
  const candidates = await candidateService.listCandidates();
  return json(200, { items: candidates });
};
