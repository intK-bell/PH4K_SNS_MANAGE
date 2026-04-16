import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import type { MetricFetchSchedulePlanItem } from "@ph4k/core";

export interface CreateMetricSchedulesParams {
  postId: string;
  baseTime: string;
  targetLambdaArn: string;
  roleArn: string;
  groupName: string;
  offsetsInHours: number[];
}

export class MetricFetchScheduler {
  constructor(
    private readonly client: SchedulerClient,
    private readonly enabled: boolean,
  ) {}

  async createSchedules(
    params: CreateMetricSchedulesParams,
  ): Promise<MetricFetchSchedulePlanItem[]> {
    const baseTime = new Date(params.baseTime);
    const plans: MetricFetchSchedulePlanItem[] = [];

    for (const offsetHours of params.offsetsInHours) {
      const scheduledAt = new Date(baseTime.getTime() + offsetHours * 60 * 60 * 1000);
      const scheduleName = `metric-fetch-${params.postId}-${offsetHours}h`;
      const scheduleExpression = `at(${scheduledAt.toISOString().slice(0, 19)})`;
      const targetInput = JSON.stringify({
        postId: params.postId,
        offsetHours,
      });
      let status: MetricFetchSchedulePlanItem["status"] = this.enabled ? "scheduled" : "planned";

      if (this.enabled) {
        const existing = await this.getSchedule(scheduleName, params.groupName);

        if (
          existing &&
          existing.ScheduleExpression === scheduleExpression &&
          existing.Target?.Arn === params.targetLambdaArn &&
          existing.Target?.RoleArn === params.roleArn &&
          existing.Target?.Input === targetInput
        ) {
          status = "skipped";
        } else {
          if (existing) {
            await this.client.send(
              new DeleteScheduleCommand({
                Name: scheduleName,
                GroupName: params.groupName,
              }),
            );
            status = "replaced";
          }

          await this.client.send(
            new CreateScheduleCommand({
              Name: scheduleName,
              GroupName: params.groupName,
              FlexibleTimeWindow: {
                Mode: "OFF",
              },
              ScheduleExpression: scheduleExpression,
              Target: {
                Arn: params.targetLambdaArn,
                RoleArn: params.roleArn,
                Input: targetInput,
              },
              ActionAfterCompletion: "DELETE",
            }),
          );
        }
      }

      plans.push({
        scheduleName,
        offsetHours,
        scheduledAt: scheduledAt.toISOString(),
        status,
      });
    }

    return plans;
  }

  private async getSchedule(name: string, groupName: string) {
    try {
      return await this.client.send(
        new GetScheduleCommand({
          Name: name,
          GroupName: groupName,
        }),
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ResourceNotFoundException"
      ) {
        return null;
      }
      throw error;
    }
  }
}

export const createMetricFetchScheduler = (
  region: string,
  enabled: boolean,
): MetricFetchScheduler => new MetricFetchScheduler(new SchedulerClient({ region }), enabled);
