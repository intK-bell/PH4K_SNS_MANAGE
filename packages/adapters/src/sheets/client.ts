import { createSign } from "node:crypto";
import type { AnalysisRow, IdeaBacklogRow, PostManagementRow } from "@ph4k/core";

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

const base64UrlEncode = (value: string): string =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

interface GoogleServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

interface SheetProperties {
  sheetId: number;
  title: string;
}

const POST_MANAGEMENT_HEADERS = [
  "ID",
  "投稿日",
  "型",
  "ネタ",
  "フック",
  "本文",
  "ステータス",
  "インプレッション",
  "いいね",
  "保存",
  "コメント",
  "リンククリック",
  "いいね率",
  "評価",
  "横展開",
  "投稿URL",
  "メモ",
];

const ANALYSIS_HEADERS = [
  "集計区分",
  "型",
  "投稿数",
  "平均インプレッション",
  "平均いいね",
  "平均保存",
  "平均コメント",
  "平均リンククリック",
  "平均いいね率",
  "最新投稿日",
  "最新ネタ",
  "最新投稿ID",
];

const IDEA_BACKLOG_HEADERS = [
  "ideaId",
  "title",
  "problem",
  "detail",
  "priority",
  "tags",
  "status",
  "useCount",
  "createdAt",
  "updatedAt",
];

const rowToValues = (row: PostManagementRow): string[] => [
  row.id,
  row.postedDate,
  row.type,
  row.ideaTitle,
  row.hook,
  row.body,
  row.status,
  row.impressions,
  row.likes,
  row.bookmarks,
  row.replies,
  row.urlLinkClicks,
  row.likeRate,
  row.evaluation,
  row.horizontalExpansion,
  row.postUrl,
  row.memo,
];

const analysisRowToValues = (row: AnalysisRow): string[] => [
  row.segment,
  row.type,
  row.postCount,
  row.averageImpressions,
  row.averageLikes,
  row.averageBookmarks,
  row.averageReplies,
  row.averageUrlLinkClicks,
  row.averageLikeRate,
  row.latestPostedDate,
  row.latestIdeaTitle,
  row.latestPostId,
];

const ideaBacklogRowToValues = (row: IdeaBacklogRow): string[] => [
  row.ideaId,
  row.title,
  row.problem,
  row.detail,
  row.priority,
  row.tags,
  row.status,
  row.useCount,
  row.createdAt,
  row.updatedAt,
];

const buildHeaderStyleRequest = (
  sheetId: number,
  endColumnIndex: number,
): Record<string, unknown> => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: 0,
      endRowIndex: 1,
      startColumnIndex: 0,
      endColumnIndex,
    },
    cell: {
      userEnteredFormat: {
        backgroundColorStyle: {
          rgbColor: {
            red: 0.09,
            green: 0.2,
            blue: 0.34,
          },
        },
        textFormat: {
          bold: true,
          foregroundColorStyle: {
            rgbColor: {
              red: 1,
              green: 1,
              blue: 1,
            },
          },
          fontSize: 10,
        },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE",
        wrapStrategy: "WRAP",
      },
    },
    fields:
      "userEnteredFormat(backgroundColorStyle,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
  },
});

const buildFrozenHeaderRequest = (sheetId: number): Record<string, unknown> => ({
  updateSheetProperties: {
    properties: {
      sheetId,
      gridProperties: {
        frozenRowCount: 1,
      },
    },
    fields: "gridProperties.frozenRowCount",
  },
});

const buildColumnWidthRequests = (
  sheetId: number,
  widths: number[],
): Array<Record<string, unknown>> =>
  widths.map((pixelSize, columnIndex) => ({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: "COLUMNS",
        startIndex: columnIndex,
        endIndex: columnIndex + 1,
      },
      properties: {
        pixelSize,
      },
      fields: "pixelSize",
    },
  }));

const buildBodyAlignmentRequest = (
  sheetId: number,
  endColumnIndex: number,
  options?: {
    centerColumns?: number[];
    rightColumns?: number[];
    wrapColumns?: number[];
  },
): Array<Record<string, unknown>> => {
  const requests: Array<Record<string, unknown>> = [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex,
        },
        cell: {
          userEnteredFormat: {
            verticalAlignment: "TOP",
          },
        },
        fields: "userEnteredFormat.verticalAlignment",
      },
    },
  ];

  for (const columnIndex of options?.centerColumns ?? []) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat.horizontalAlignment",
      },
    });
  }

  for (const columnIndex of options?.rightColumns ?? []) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat.horizontalAlignment",
      },
    });
  }

  for (const columnIndex of options?.wrapColumns ?? []) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy",
      },
    });
  }

  return requests;
};

const buildAnalysisTotalRowStyleRequest = (
  sheetId: number,
): Record<string, unknown> => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: 1,
      endRowIndex: 2,
      startColumnIndex: 0,
      endColumnIndex: ANALYSIS_HEADERS.length,
    },
    cell: {
      userEnteredFormat: {
        backgroundColorStyle: {
          rgbColor: {
            red: 0.9,
            green: 0.95,
            blue: 0.99,
          },
        },
        textFormat: {
          bold: true,
        },
      },
    },
    fields: "userEnteredFormat(backgroundColorStyle,textFormat)",
  },
});

const buildBasicFilterRequest = (
  sheetId: number,
  endColumnIndex: number,
): Record<string, unknown> => ({
  setBasicFilter: {
    filter: {
      range: {
        sheetId,
        startRowIndex: 0,
        startColumnIndex: 0,
        endColumnIndex,
      },
    },
  },
});

const buildPostStatusHighlightRequest = (
  sheetId: number,
): Record<string, unknown> => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: 1,
      startColumnIndex: 6,
      endColumnIndex: 7,
    },
    cell: {
      userEnteredFormat: {
        textFormat: {
          bold: true,
        },
      },
    },
    fields: "userEnteredFormat.textFormat.bold",
  },
});

export class GoogleSheetsClient {
  constructor(
    private readonly config: GoogleServiceAccountConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return (
      this.config.clientEmail.trim() !== "" &&
      this.config.privateKey.trim() !== "" &&
      this.config.spreadsheetId.trim() !== ""
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: this.config.clientEmail,
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
      .sign(this.config.privateKey.replace(/\\n/g, "\n"), "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const assertion = `${header}.${payload}.${signature}`;
    const response = await this.fetchImpl(GOOGLE_TOKEN_URI, {
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

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new Error("google access token missing");
    }

    return data.access_token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const requestInit: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    };
    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await this.fetchImpl(
      `${SHEETS_BASE_URL}/${this.config.spreadsheetId}/${path}`,
      requestInit,
    );

    if (!response.ok) {
      throw new Error(`google sheets request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async listSheetProperties(): Promise<Map<string, SheetProperties>> {
    const spreadsheet = await this.request<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    }>("GET", "");

    return new Map(
      (spreadsheet.sheets ?? [])
        .map((sheet) => {
          const sheetId = sheet.properties?.sheetId;
          const title = sheet.properties?.title;
          if (sheetId === undefined || !title) {
            return null;
          }
          return [title, { sheetId, title }] as const;
        })
        .filter((entry): entry is readonly [string, SheetProperties] => entry !== null),
    );
  }

  private async ensureSheets(): Promise<Map<string, SheetProperties>> {
    const sheetProperties = await this.listSheetProperties();
    const hasPostManagement = sheetProperties.has("投稿管理");
    const hasAnalysis = sheetProperties.has("分析");
    const hasIdeaBacklog = sheetProperties.has("ネタ帳");

    const requests: Array<Record<string, unknown>> = [];

    if (!hasPostManagement) {
      requests.push({
        addSheet: {
          properties: {
            title: "投稿管理",
          },
        },
      });
    }

    if (!hasAnalysis) {
      requests.push({
        addSheet: {
          properties: {
            title: "分析",
          },
        },
      });
    }

    if (!hasIdeaBacklog) {
      requests.push({
        addSheet: {
          properties: {
            title: "ネタ帳",
          },
        },
      });
    }

    if (requests.length > 0) {
      await this.request("POST", ":batchUpdate", { requests });
    }

    const refreshedSheetProperties =
      requests.length > 0 ? await this.listSheetProperties() : sheetProperties;

    await this.request("PUT", "values/%E6%8A%95%E7%A8%BF%E7%AE%A1%E7%90%86!A1:Q1?valueInputOption=RAW", {
      range: "投稿管理!A1:Q1",
      majorDimension: "ROWS",
      values: [POST_MANAGEMENT_HEADERS],
    });

    await this.request("PUT", "values/%E5%88%86%E6%9E%90!A1:L1?valueInputOption=RAW", {
      range: "分析!A1:L1",
      majorDimension: "ROWS",
      values: [ANALYSIS_HEADERS],
    });

    await this.request("PUT", "values/%E3%83%8D%E3%82%BF%E5%B8%B3!A1:J1?valueInputOption=RAW", {
      range: "ネタ帳!A1:J1",
      majorDimension: "ROWS",
      values: [IDEA_BACKLOG_HEADERS],
    });

    return refreshedSheetProperties;
  }

  private async applyAnalysisSheetFormatting(sheetId: number): Promise<void> {
    await this.request("POST", ":batchUpdate", {
      requests: [
        buildFrozenHeaderRequest(sheetId),
        buildHeaderStyleRequest(sheetId, ANALYSIS_HEADERS.length),
        ...buildColumnWidthRequests(sheetId, [110, 150, 90, 150, 110, 110, 110, 120, 130, 160, 240, 180]),
        ...buildBodyAlignmentRequest(sheetId, ANALYSIS_HEADERS.length, {
          centerColumns: [0, 1, 2, 9],
          rightColumns: [3, 4, 5, 6, 7, 8],
          wrapColumns: [10, 11],
        }),
        buildBasicFilterRequest(sheetId, ANALYSIS_HEADERS.length),
        buildAnalysisTotalRowStyleRequest(sheetId),
      ],
    });
  }

  private async applyPostManagementSheetFormatting(sheetId: number): Promise<void> {
    await this.request("POST", ":batchUpdate", {
      requests: [
        buildFrozenHeaderRequest(sheetId),
        buildHeaderStyleRequest(sheetId, POST_MANAGEMENT_HEADERS.length),
        ...buildColumnWidthRequests(sheetId, [
          170,
          165,
          135,
          220,
          280,
          360,
          130,
          115,
          95,
          95,
          95,
          110,
          110,
          100,
          120,
          220,
          220,
        ]),
        ...buildBodyAlignmentRequest(sheetId, POST_MANAGEMENT_HEADERS.length, {
          centerColumns: [1, 2, 6],
          rightColumns: [7, 8, 9, 10, 11, 12],
          wrapColumns: [3, 4, 5, 15, 16],
        }),
        buildBasicFilterRequest(sheetId, POST_MANAGEMENT_HEADERS.length),
        buildPostStatusHighlightRequest(sheetId),
      ],
    });
  }

  private async applyIdeaBacklogSheetFormatting(sheetId: number): Promise<void> {
    await this.request("POST", ":batchUpdate", {
      requests: [
        buildFrozenHeaderRequest(sheetId),
        buildHeaderStyleRequest(sheetId, IDEA_BACKLOG_HEADERS.length),
        ...buildColumnWidthRequests(sheetId, [170, 220, 260, 360, 90, 200, 110, 90, 170, 170]),
        ...buildBodyAlignmentRequest(sheetId, IDEA_BACKLOG_HEADERS.length, {
          centerColumns: [4, 6, 7],
          wrapColumns: [1, 2, 3, 5, 8, 9],
        }),
        buildBasicFilterRequest(sheetId, IDEA_BACKLOG_HEADERS.length),
      ],
    });
  }

  private async findRowIndexById(postId: string): Promise<number | null> {
    const response = await this.request<{ values?: string[][] }>(
      "GET",
      "values/%E6%8A%95%E7%A8%BF%E7%AE%A1%E7%90%86!A:A",
    );

    const rows = response.values ?? [];
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index]?.[0] === postId) {
        return index + 1;
      }
    }
    return null;
  }

  async upsertPostManagementRow(row: PostManagementRow): Promise<{ mode: "inserted" | "updated" }> {
    if (!this.isConfigured()) {
      return { mode: "inserted" };
    }

    const sheetProperties = await this.ensureSheets();
    const rowIndex = await this.findRowIndexById(row.id);
    const values = [rowToValues(row)];

    if (rowIndex) {
      await this.request(
        "PUT",
        `values/%E6%8A%95%E7%A8%BF%E7%AE%A1%E7%90%86!A${rowIndex}:Q${rowIndex}?valueInputOption=RAW`,
        {
          range: `投稿管理!A${rowIndex}:Q${rowIndex}`,
          majorDimension: "ROWS",
          values,
        },
      );
      const postManagementSheetId = sheetProperties.get("投稿管理")?.sheetId;
      if (postManagementSheetId !== undefined) {
        await this.applyPostManagementSheetFormatting(postManagementSheetId);
      }
      return { mode: "updated" };
    }

    await this.request(
      "POST",
      "values/%E6%8A%95%E7%A8%BF%E7%AE%A1%E7%90%86!A:Q:append?valueInputOption=RAW",
      {
        range: "投稿管理!A:Q",
        majorDimension: "ROWS",
        values,
      },
    );

    const postManagementSheetId = sheetProperties.get("投稿管理")?.sheetId;
    if (postManagementSheetId !== undefined) {
      await this.applyPostManagementSheetFormatting(postManagementSheetId);
    }

    return { mode: "inserted" };
  }

  async replaceAnalysisRows(rows: AnalysisRow[]): Promise<{ rowCount: number }> {
    if (!this.isConfigured()) {
      return { rowCount: rows.length };
    }

    const sheetProperties = await this.ensureSheets();
    await this.request(
      "POST",
      "values/%E5%88%86%E6%9E%90!A2:L:clear",
      {},
    );

    const values = rows.map((row) => analysisRowToValues(row));
    const analysisRange = `分析!A2:L${Math.max(rows.length + 1, 2)}`;
    await this.request(
      "PUT",
      `values/${encodeURIComponent(analysisRange)}?valueInputOption=RAW`,
      {
        range: analysisRange,
        majorDimension: "ROWS",
        values,
      },
    );

    const analysisSheetId = sheetProperties.get("分析")?.sheetId;
    if (analysisSheetId !== undefined) {
      try {
        await this.applyAnalysisSheetFormatting(analysisSheetId);
      } catch (error) {
        console.warn("analysis sheet formatting skipped", error);
      }
    }

    return { rowCount: rows.length };
  }

  async replaceIdeaBacklogRows(rows: IdeaBacklogRow[]): Promise<{ rowCount: number }> {
    if (!this.isConfigured()) {
      return { rowCount: rows.length };
    }

    const sheetProperties = await this.ensureSheets();
    await this.request(
      "POST",
      "values/%E3%83%8D%E3%82%BF%E5%B8%B3!A2:J:clear",
      {},
    );

    const values = rows.map((row) => ideaBacklogRowToValues(row));
    const ideaBacklogRange = `ネタ帳!A2:J${Math.max(rows.length + 1, 2)}`;
    await this.request(
      "PUT",
      `values/${encodeURIComponent(ideaBacklogRange)}?valueInputOption=RAW`,
      {
        range: ideaBacklogRange,
        majorDimension: "ROWS",
        values,
      },
    );

    const ideaBacklogSheetId = sheetProperties.get("ネタ帳")?.sheetId;
    if (ideaBacklogSheetId !== undefined) {
      await this.applyIdeaBacklogSheetFormatting(ideaBacklogSheetId);
    }

    return { rowCount: rows.length };
  }
}
