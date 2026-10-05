-- Target fingerprint cache for change gating: stat summary (mtime + size)
-- of a target's source files, serialized. Persisted next to the watermark so
-- periodic runs skip targets whose files are unchanged since the last sync.
ALTER TABLE profile_watermarks ADD COLUMN last_fingerprint TEXT;
