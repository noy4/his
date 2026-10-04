-- favicons.db · permanent store · no TTL
CREATE TABLE favicons (
  id         INTEGER PRIMARY KEY,
  host       TEXT    NOT NULL UNIQUE,       -- www-stripped (+ root-domain fallback at read)
  data       BLOB    NOT NULL,
  data_type  TEXT    NOT NULL,              -- png | svg | ico | webp | jpeg | gif
  width      INTEGER NOT NULL DEFAULT 0,    -- best quality wins · never downgraded (svg = 0)
  updated_at INTEGER NOT NULL               -- epoch ms · harvest time = diff baseline
);
