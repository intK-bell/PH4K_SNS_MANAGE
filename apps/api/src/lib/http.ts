import type { ApiResponse } from "./api-types.js";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (statusCode: number, data: unknown): ApiResponse => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
  },
  body: JSON.stringify(data),
});

export const redirect = (location: string, statusCode = 302): ApiResponse => ({
  statusCode,
  headers: {
    location,
    "content-type": "text/plain; charset=utf-8",
  },
  body: "",
});
