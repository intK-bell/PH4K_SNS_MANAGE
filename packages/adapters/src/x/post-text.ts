import { randomBytes } from "node:crypto";

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/$/, "");

const removeUrls = (value: string): string =>
  value
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const createTrackingShortId = (): string => randomBytes(6).toString("base64url");

export const buildTrackingUrl = (
  baseUrl: string,
  shortId: string,
  landingUrl: string,
): string => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (normalizedBaseUrl !== "") {
    return `${normalizedBaseUrl}/r/${shortId}`;
  }

  return landingUrl.trim();
};

export const buildPublishPostText = (
  hook: string,
  body: string,
  destinationUrl: string,
): string => {
  const trimmedHook = hook.trim();
  const cleanedBody = removeUrls(body.trim());
  const trimmedUrl = destinationUrl.trim();

  return [trimmedHook, cleanedBody, trimmedUrl]
    .filter((section) => section !== "")
    .join("\n")
    .trim();
};
