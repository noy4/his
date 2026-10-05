-- Align the stored transition vocabulary with the WebExtensions
-- history.TransitionType enum: chromium core 6 START_PAGE is auto_toplevel
-- in the WebExtensions surface (https://developer.mozilla.org/en-US/docs/
-- Mozilla/Add-ons/WebExtensions/API/history/TransitionType). KEYWORD /
-- KEYWORD_GENERATED are additions, so only the rename needs a rewrite.
UPDATE visits SET transition = 'AUTO_TOPLEVEL' WHERE transition = 'START_PAGE';
