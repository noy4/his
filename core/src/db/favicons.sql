CREATE TABLE favicons (
  domain      TEXT    PRIMARY KEY,
  data        BLOB    NOT NULL,
  data_type   TEXT    NOT NULL,
  width       INTEGER,
  updated_at  INTEGER NOT NULL
);
