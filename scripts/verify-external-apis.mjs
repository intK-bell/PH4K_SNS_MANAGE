import { createHmac, createSign, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const envFilePath = path.join(projectRoot, ".env");
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

const loadDotEnv = () => {
  if (!existsSync(envFilePath)) {
    return;
  }

  const content = readFileSync(envFilePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);
    if (process.env[key] !== undefined) {
      continue;
    }

    const normalizedValue = rawValue
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");

    process.env[key] = normalizedValue;
  }
};

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const encode = (value) =>
  encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27");

const buildQueryString = (params) =>
  Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");

const buildOauthHeader = (method, url, config, queryParams = {}) => {
  const oauthParams = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  const signatureBaseString = [
    method.toUpperCase(),
    encode(url),
    encode(buildQueryString({ ...oauthParams, ...queryParams })),
  ].join("&");

  const signingKey = `${encode(config.apiKeySecret)}&${encode(config.accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  return `OAuth ${Object.entries(oauthParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(", ")}`;
};

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const buildErrorDetail = (prefix, response, payload) => {
  const detail =
    payload?.message ??
    payload?.details ??
    payload?.errors?.[0]?.detail ??
    payload?.errors?.[0]?.message ??
    payload?.errors?.[0]?.title ??
    payload?.error?.message ??
    payload?.raw ??
    response.status;

  return `${prefix}: ${detail}`;
};

const getGoogleAccessToken = async () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";

  if (!clientEmail || !privateKey) {
    throw new Error("google service account env is missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: GOOGLE_TOKEN_URI,
      exp: now + 3600,
      iat: now,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer
    .sign(privateKey.replace(/\\n/g, "\n"), "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${header}.${payload}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`google token request failed: ${response.status}`);
  }

  const payloadJson = await response.json();
  if (!payloadJson.access_token) {
    throw new Error("google access token missing");
  }

  return payloadJson.access_token;
};

const checkLinePush = async () => {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  const userId = process.env.LINE_USER_ID ?? "";

  if (!token || !userId) {
    throw new Error("line env is missing");
  }

  const verifyResponse = await fetch("https://api.line.me/v2/bot/info", {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!verifyResponse.ok) {
    const payload = await parseJsonSafely(verifyResponse);
    throw new Error(buildErrorDetail("line bot info failed", verifyResponse, payload));
  }

  const botInfo = await parseJsonSafely(verifyResponse);

  const pushResponse = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: "text",
          text: `[PH4K 疎通確認]\nLINE push 疎通OK\n${new Date().toISOString()}`,
        },
      ],
    }),
  });

  if (!pushResponse.ok) {
    const payload = await parseJsonSafely(pushResponse);
    throw new Error(buildErrorDetail("line push failed", pushResponse, payload));
  }

  return {
    name: "LINE",
    details: `bot=${botInfo.displayName ?? "unknown"}`,
  };
};

const getXAuthorizationHeader = () => {
  const apiKey = process.env.X_API_KEY ?? "";
  const apiKeySecret = process.env.X_API_KEY_SECRET ?? "";
  const accessToken = process.env.X_ACCESS_TOKEN ?? "";
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET ?? "";
  const bearerToken = process.env.X_BEARER_TOKEN ?? "";

  if (apiKey && apiKeySecret && accessToken && accessTokenSecret) {
    return {
      type: "oauth1",
      header: buildOauthHeader("GET", "https://api.x.com/2/users/me", {
        apiKey,
        apiKeySecret,
        accessToken,
        accessTokenSecret,
      }),
    };
  }

  if (bearerToken) {
    return {
      type: "bearer",
      header: `Bearer ${bearerToken}`,
    };
  }

  throw new Error("x env is missing");
};

const checkXReadAndMetrics = async () => {
  const authorization = getXAuthorizationHeader();

  const meResponse = await fetch("https://api.x.com/2/users/me", {
    method: "GET",
    headers: {
      authorization: authorization.header,
    },
  });

  const mePayload = await parseJsonSafely(meResponse);
  if (!meResponse.ok || !mePayload.data?.id) {
    throw new Error(buildErrorDetail("x users/me failed", meResponse, mePayload));
  }

  const tweetQueryParams = {
    max_results: "5",
    "tweet.fields": "public_metrics,created_at",
  };
  const tweetEndpoint = `https://api.x.com/2/users/${mePayload.data.id}/tweets`;
  const tweetAuthHeader =
    authorization.type === "oauth1"
      ? buildOauthHeader(
          "GET",
          tweetEndpoint,
          {
            apiKey: process.env.X_API_KEY ?? "",
            apiKeySecret: process.env.X_API_KEY_SECRET ?? "",
            accessToken: process.env.X_ACCESS_TOKEN ?? "",
            accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET ?? "",
          },
          tweetQueryParams,
        )
      : authorization.header;

  const tweetsResponse = await fetch(
    `${tweetEndpoint}?${new URLSearchParams(tweetQueryParams).toString()}`,
    {
      method: "GET",
      headers: {
        authorization: tweetAuthHeader,
      },
    },
  );

  const tweetsPayload = await parseJsonSafely(tweetsResponse);
  if (!tweetsResponse.ok) {
    throw new Error(buildErrorDetail("x recent tweets failed", tweetsResponse, tweetsPayload));
  }

  const recentCount = Array.isArray(tweetsPayload.data) ? tweetsPayload.data.length : 0;

  return {
    name: "X",
    details: `auth=${authorization.type}, user=@${mePayload.data.username ?? "unknown"}, recentTweets=${recentCount}`,
  };
};

const checkGoogleSheets = async () => {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID ?? "";
  if (!spreadsheetId) {
    throw new Error("google spreadsheet id is missing");
  }

  const accessToken = await getGoogleAccessToken();
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

  const metadataResponse = await fetch(baseUrl, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!metadataResponse.ok) {
    const payload = await parseJsonSafely(metadataResponse);
    throw new Error(buildErrorDetail("google sheets metadata failed", metadataResponse, payload));
  }

  const metadata = await parseJsonSafely(metadataResponse);
  const existingSheetTitles = new Set(
    (metadata.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title) => typeof title === "string"),
  );

  if (!existingSheetTitles.has("運用確認")) {
    const addSheetResponse = await fetch(`${baseUrl}:batchUpdate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: "運用確認",
              },
            },
          },
        ],
      }),
    });

    if (!addSheetResponse.ok) {
      const payload = await parseJsonSafely(addSheetResponse);
      throw new Error(buildErrorDetail("google sheets addSheet failed", addSheetResponse, payload));
    }
  }

  const writeResponse = await fetch(
    `${baseUrl}/values/${encodeURIComponent("運用確認!A1:C4")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        range: "運用確認!A1:C4",
        majorDimension: "ROWS",
        values: [
          ["項目", "結果", "更新時刻"],
          ["LINE", "疎通確認済み", new Date().toISOString()],
          ["X", "疎通確認済み", new Date().toISOString()],
          ["Sheets", "書き込み確認済み", new Date().toISOString()],
        ],
      }),
    },
  );

  if (!writeResponse.ok) {
    const payload = await parseJsonSafely(writeResponse);
    throw new Error(buildErrorDetail("google sheets write failed", writeResponse, payload));
  }

  return {
    name: "Google Sheets",
    details: `title=${metadata.properties?.title ?? "unknown"}, sheets=${metadata.sheets?.length ?? 0}`,
  };
};

const main = async () => {
  loadDotEnv();

  const checks = [checkLinePush, checkXReadAndMetrics, checkGoogleSheets];
  const results = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push({ status: "ok", ...result });
    } catch (error) {
      results.push({
        status: "ng",
        name: check.name.replace(/^check/, ""),
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));

  if (results.some((result) => result.status !== "ok")) {
    process.exitCode = 1;
  }
};

await main();
