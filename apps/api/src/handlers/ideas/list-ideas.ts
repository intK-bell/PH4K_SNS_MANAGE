import { json } from "../../lib/http.js";
import { ideaService } from "../../lib/container.js";

export const listIdeas = async () => {
  const ideas = await ideaService.listIdeas();
  return json(200, { items: ideas });
};
