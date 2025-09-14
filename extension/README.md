# AI Study Copilot – Chrome Extension (Sidebar)

This is the **frontend-only** build of the AI Study Copilot Chrome extension. It renders as a **sidebar (side panel)**, not a popup.

## Install Locally (Developer Mode)

1. Open **Chrome** (version 114+).
2. Navigate to `chrome://extensions`.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select the `extension/` folder in this repo.
5. The extension icon will appear in the toolbar. Click it to open the sidebar.

## Folder Structure

```
extension/
├─ manifest.json      # MV3 manifest declaring side_panel
├─ sidebar.html       # Tailwind-styled UI with 3 tabs
├─ sidebar.js         # Tab logic + placeholder handlers
├─ background.js      # Opens side panel when icon clicked
├─ icons/             # Place icon128.svg here
└─ README.md          # This file
```

## Next Steps

This build is frontend-only. To connect to the backend:

1. Replace placeholder logic in `sidebar.js` with `fetch()` calls to your API endpoints (e.g., `/api/chat/ask`).
2. Wire notes/mind map calls similarly.
3. Add OAuth/session if needed.
