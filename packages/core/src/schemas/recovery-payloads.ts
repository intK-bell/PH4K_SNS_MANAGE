export interface UpdateSpreadsheetSyncInput {
  spreadsheetSyncStatus: "pending" | "synced" | "failed";
  spreadsheetSyncAttempts: number;
  spreadsheetLastSyncedAt: string | null;
  spreadsheetNextRetryAt: string | null;
  spreadsheetSyncError: string | null;
}
