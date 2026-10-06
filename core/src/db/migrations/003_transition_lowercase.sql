-- lowercase the stored transitions to match the WebExtensions wire format
UPDATE visits SET transition = lower(transition) WHERE transition != lower(transition);
