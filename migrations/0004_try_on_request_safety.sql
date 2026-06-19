CREATE TABLE IF NOT EXISTS try_on_request_limits (
  id TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_try_on_request_limits_window_date
  ON try_on_request_limits(window_date);

CREATE INDEX IF NOT EXISTS idx_try_on_requests_expires_at
  ON try_on_requests(expires_at);
