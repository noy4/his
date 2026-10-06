-- rename chromium START_PAGE to the WebExtensions AUTO_TOPLEVEL
UPDATE visits SET transition = 'AUTO_TOPLEVEL' WHERE transition = 'START_PAGE';
