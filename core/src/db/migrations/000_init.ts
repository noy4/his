import { sql, type Kysely } from 'kysely'

// Squash of 000..006 into the archive's final schema.
// 004 (source_profiles FK rebuild) is structure-identical to 000, 005 drops
// display_name, and 002/003 were data-only updates, so none survive here.
// Forward-only: no down (delete the db file to reset).
export async function up(db: Kysely<any>): Promise<void> {
  // Browser profiles
  await sql`
    CREATE TABLE source_profiles (
      id            INTEGER PRIMARY KEY NOT NULL,
      browser       TEXT    NOT NULL,
      profile       TEXT    NOT NULL,
      kind          TEXT    NOT NULL,
      profile_path  TEXT    NOT NULL,
      UNIQUE(browser, profile)
    )
  `.execute(db)

  // WebExtensions history API HistoryItem
  await sql`
    CREATE TABLE urls (
      id               INTEGER PRIMARY KEY NOT NULL,
      url              TEXT    NOT NULL UNIQUE,
      title            TEXT,
      first_visit_time INTEGER NOT NULL,
      last_visit_time  INTEGER NOT NULL,
      visit_count      INTEGER NOT NULL DEFAULT 0,
      typed_count      INTEGER NOT NULL DEFAULT 0
    )
  `.execute(db)

  // WebExtensions history API VisitItem
  await sql`
    CREATE TABLE visits (
      id                INTEGER PRIMARY KEY NOT NULL,
      url_id            INTEGER NOT NULL REFERENCES urls(id),
      visit_time        INTEGER NOT NULL,
      transition        TEXT    NOT NULL,
      source_profile_id INTEGER NOT NULL REFERENCES source_profiles(id),
      source_visit_id   INTEGER NOT NULL,
      UNIQUE(source_profile_id, source_visit_id)
    )
  `.execute(db)

  await sql`CREATE INDEX idx_visits_visit_time ON visits(visit_time DESC)`.execute(db)
  await sql`CREATE INDEX idx_visits_url_id_visit_time ON visits(url_id, visit_time DESC)`.execute(db)
  await sql`CREATE INDEX idx_urls_last_visit_time ON urls(last_visit_time DESC)`.execute(db)

  // Sync cursor + change-gate fingerprint per profile
  await sql`
    CREATE TABLE profile_watermarks (
      source_profile_id    INTEGER PRIMARY KEY NOT NULL REFERENCES source_profiles(id),
      last_source_visit_id INTEGER NOT NULL DEFAULT 0,
      source_id_offset     INTEGER NOT NULL DEFAULT 0,
      last_run_at          INTEGER,
      last_fingerprint     TEXT
    )
  `.execute(db)

  // Full-text search over urls (trigram tokenizer)
  await sql`
    CREATE VIRTUAL TABLE urls_fts USING fts5(
      title, url,
      content='urls', content_rowid='id',
      tokenize='trigram'
    )
  `.execute(db)

  await sql`
    CREATE TRIGGER urls_fts_after_insert AFTER INSERT ON urls BEGIN
      INSERT INTO urls_fts(rowid, title, url)
      VALUES (new.id, new.title, new.url);
    END
  `.execute(db)

  await sql`
    CREATE TRIGGER urls_fts_after_delete AFTER DELETE ON urls BEGIN
      INSERT INTO urls_fts(urls_fts, rowid, title, url)
      VALUES ('delete', old.id, old.title, old.url);
    END
  `.execute(db)

  await sql`
    CREATE TRIGGER urls_fts_after_update AFTER UPDATE ON urls BEGIN
      INSERT INTO urls_fts(urls_fts, rowid, title, url)
      VALUES ('delete', old.id, old.title, old.url);
      INSERT INTO urls_fts(rowid, title, url)
      VALUES (new.id, new.title, new.url);
    END
  `.execute(db)

  // key/value user settings (`hidden_patterns` = JSON string[])
  await sql`
    CREATE TABLE settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )
  `.execute(db)

  // URLs hidden by those patterns; separate table to avoid urls/FTS updates
  await sql`
    CREATE TABLE hidden_urls (
      url_id INTEGER PRIMARY KEY NOT NULL REFERENCES urls(id) ON DELETE CASCADE
    )
  `.execute(db)
}
