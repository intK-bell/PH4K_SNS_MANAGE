import { ideaService } from "../../lib/container.js";
import { json } from "../../lib/http.js";
import { validateCreateIdeaInput } from "../../lib/idea-validation.js";
import { parseJsonBody } from "../../lib/request.js";

export const createIdea = async (body: string | null) => {
  const payload = validateCreateIdeaInput(parseJsonBody(body));
  const created = await ideaService.createIdea(payload);
  return json(201, created);
};
