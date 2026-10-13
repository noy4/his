-- key/value user settings (`hidden_patterns` = JSON string[])
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- URLs hidden by those patterns; separate table to avoid urls/FTS updates
CREATE TABLE hidden_urls (
  url_id INTEGER PRIMARY KEY REFERENCES urls(id) ON DELETE CASCADE
);
