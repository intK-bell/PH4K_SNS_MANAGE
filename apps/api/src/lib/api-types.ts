export interface ApiGatewayEvent {
  httpMethod: string;
  path: string;
  pathParameters: Record<string, string> | null;
  headers?: Record<string, string | undefined> | null;
  body: string | null;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
