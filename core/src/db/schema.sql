-- Browser profiles
CREATE TABLE source_profiles (
  id            INTEGER PRIMARY KEY,
  browser       TEXT    NOT NULL,
  profile       TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  display_name  TEXT,
  profile_path  TEXT    NOT NULL,
  UNIQUE(browser, profile)
);

-- WebExtensions history API HistoryItem:
-- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/HistoryItem
CREATE TABLE urls (
  id               INTEGER PRIMARY KEY,
  url              TEXT    NOT NULL UNIQUE,
  title            TEXT,
  first_visit_time INTEGER NOT NULL, -- not in HistoryItem
  last_visit_time  INTEGER NOT NULL,
  visit_count      INTEGER NOT NULL DEFAULT 0,
  typed_count      INTEGER NOT NULL DEFAULT 0,
  hidden_at        INTEGER           -- not in HistoryItem
);

-- WebExtensions history API VisitItem:
-- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/VisitItem
CREATE TABLE visits (
  id                INTEGER PRIMARY KEY,                  -- = VisitItem.visitId
  url_id            INTEGER NOT NULL REFERENCES urls(id), -- = VisitItem.id (= HistoryItem.id)
  visit_time        INTEGER NOT NULL,
  transition        TEXT    NOT NULL,
  source_profile_id INTEGER NOT NULL REFERENCES source_profiles(id), -- not in VisitItem
  source_visit_id   INTEGER NOT NULL,                                -- not in VisitItem
  UNIQUE(source_profile_id, source_visit_id)
);

CREATE INDEX idx_visits_visit_time        ON visits(visit_time DESC);
CREATE INDEX idx_visits_url_id_visit_time ON visits(url_id, visit_time DESC);
CREATE INDEX idx_urls_last_visit_time     ON urls(last_visit_time DESC);

-- Sync cursor per profile
CREATE TABLE profile_watermarks (
  source_profile_id    INTEGER PRIMARY KEY REFERENCES source_profiles(id),
  last_source_visit_id INTEGER NOT NULL DEFAULT 0,     -- last imported source visit id
  source_id_offset     INTEGER NOT NULL DEFAULT 0,     -- keeps ids unique across history clears
  last_run_at          INTEGER
);

CREATE VIRTUAL TABLE urls_fts USING fts5(
  title, url,
  content='urls', content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER urls_fts_after_insert AFTER INSERT ON urls BEGIN
  INSERT INTO urls_fts(rowid, title, url)
  VALUES (new.id, new.title, new.url);
END;

CREATE TRIGGER urls_fts_after_delete AFTER DELETE ON urls BEGIN
  INSERT INTO urls_fts(urls_fts, rowid, title, url)
  VALUES ('delete', old.id, old.title, old.url);
END;

CREATE TRIGGER urls_fts_after_update AFTER UPDATE ON urls BEGIN
  INSERT INTO urls_fts(urls_fts, rowid, title, url)
  VALUES ('delete', old.id, old.title, old.url);
  INSERT INTO urls_fts(rowid, title, url)
  VALUES (new.id, new.title, new.url);
END;
