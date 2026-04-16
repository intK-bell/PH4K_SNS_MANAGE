export interface CreateMetricFetchScheduleInput {
  postId: string;
}

export interface MetricFetchSchedulePlanItem {
  scheduleName: string;
  offsetHours: number;
  scheduledAt: string;
  status: "scheduled" | "planned" | "skipped" | "replaced";
}
