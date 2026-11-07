export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_SHEET_ID: string;
  GOOGLE_SHEET_RANGE: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  SYNC_SECRET: string;
  METADATA_BATCH_SIZE: string;
}

export interface SheetRow {
  contentType: string;
  sourceUrl: string;
  favourite: boolean;
  company: string;
  platform: string;
  overview: string;
  titleOverride: string;
  imageOverride: string;
  sortOrder: number | null;
  published: boolean;
  displayOrder: number;
}
