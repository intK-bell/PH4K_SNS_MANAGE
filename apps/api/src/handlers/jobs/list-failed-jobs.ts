import { failedJobService } from "../../lib/container.js";
import { json } from "../../lib/http.js";

export const listFailedJobs = async () => {
  const jobs = await failedJobService.listFailedJobs();
  return json(200, jobs);
};
