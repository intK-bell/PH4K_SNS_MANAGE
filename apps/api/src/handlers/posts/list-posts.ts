import { postService } from "../../lib/container.js";
import { json } from "../../lib/http.js";

export const listPosts = async () => {
  const posts = await postService.listPosts();
  return json(200, { items: posts });
};
