-- WebExtensions history.TransitionType is lowercase on the wire ("link"),
-- and we store enum values as-is. Rewrite the legacy uppercase rows one-to-one.
UPDATE visits SET transition = lower(transition) WHERE transition != lower(transition);
