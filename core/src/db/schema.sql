CREATE TABLE source_profiles (
  id            INTEGER PRIMARY KEY,
  kind          TEXT    NOT NULL,
  display_name  TEXT,
  profile_path  TEXT    NOT NULL,
  UNIQUE(kind, profile_path)
);

CREATE TABLE urls (
  id               INTEGER PRIMARY KEY,
  url              TEXT    NOT NULL UNIQUE,
  title            TEXT,
  visit_count      INTEGER NOT NULL DEFAULT 0,
  typed_count      INTEGER NOT NULL DEFAULT 0,
  first_visit_time INTEGER NOT NULL,
  last_visit_time  INTEGER NOT NULL,
  hidden_at        INTEGER
);

CREATE TABLE visits (
  id                INTEGER PRIMARY KEY,
  url_id            INTEGER NOT NULL REFERENCES urls(id),
  visit_time        INTEGER NOT NULL,
  transition        TEXT    NOT NULL,
  source_profile_id INTEGER NOT NULL REFERENCES source_profiles(id),
  source_visit_id   INTEGER NOT NULL,
  source_transition TEXT,
  UNIQUE(source_profile_id, source_visit_id)
);

CREATE INDEX visits_time ON visits(visit_time DESC);
CREATE INDEX visits_url  ON visits(url_id, visit_time DESC);
CREATE INDEX urls_last   ON urls(last_visit_time DESC);

CREATE TABLE profile_watermarks (
  source_profile_id    INTEGER PRIMARY KEY REFERENCES source_profiles(id),
  last_source_visit_id INTEGER NOT NULL DEFAULT 0,
  source_id_offset     INTEGER NOT NULL DEFAULT 0,
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
