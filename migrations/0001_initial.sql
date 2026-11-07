CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('blog', 'web-copy', 'social-media')),
  content_type TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  favourite INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0, 1)),
  custom_overview TEXT NOT NULL DEFAULT '',
  metadata_title TEXT NOT NULL DEFAULT '',
  metadata_description TEXT NOT NULL DEFAULT '',
  metadata_image_url TEXT NOT NULL DEFAULT '',
  manual_title_override TEXT NOT NULL DEFAULT '',
  manual_image_override TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  metadata_fetch_status TEXT NOT NULL DEFAULT 'pending',
  metadata_error TEXT NOT NULL DEFAULT '',
  last_metadata_refresh TEXT,
  last_sheet_sync TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio_items(category, published, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_company ON portfolio_items(category, company, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_content_type ON portfolio_items(category, content_type, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_platform ON portfolio_items(category, platform, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_favourites ON portfolio_items(favourite, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_metadata_queue ON portfolio_items(metadata_fetch_status, favourite DESC, display_order);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT ''
);
