-- Per-profile sync cursor, change gate and id offset
ALTER TABLE profile_watermarks RENAME TO sync_checkpoints;
