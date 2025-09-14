# Copilot Instructions for AI Study Copilot (hackMIT)

## Project Overview
- **AI Study Copilot** is a stateful AI companion for students, combining memory, notes, and mind-maps across a Chrome extension and website.
- **Architecture:**
  - **Chrome Extension** (MV3, JS, Tailwind): Floating panel with Ask AI, Notes, Mind Map tabs.
  - **Website** (Vanilla HTML/JS, Tailwind): Dashboard, Notes, Mind Map, and Chat pages.
  - **Backend** (Node.js or Python): API endpoints for chat, notes, mind map, and memory, integrating with Anthropic, Supabase, and Mem0.
  - **Supabase** (Postgres + pgvector): Stores notes, mind map, and memory embeddings.

## Key Conventions & Patterns
- **No React:** Use only plain HTML/JS and Tailwind for UI.
- **Directory Structure:**
  - `extension/` — Chrome extension code
  - `web/` — Website frontend
  - `api/` — Backend API
- **Memory:**
  - Use Mem0 for all memory operations, namespaced by `user_id`.
  - Persist all data in Supabase (Postgres + pgvector).
- **Backend:**
  - All Anthropic API calls must go through backend (never expose keys to frontend/extension).
  - API endpoints:
    - `/api/chat/ask` — Handles chat, injects memory/notes/mind map context.
    - `/api/notes/*`, `/api/mindmap/*` — CRUD for notes and mind map.
    - `/api/memory/*` — Add/query memory via Mem0.
- **Prompting:**
  - System prompt: "You are Study Copilot. You have access to user memories, notes, and mind-map..."
  - User prompt template includes user id, top memories, notes, mind map nodes, and the query.

## Developer Workflows
- **Build:**
  - Chrome extension: Standard MV3 build (no React tooling).
  - Website: Static HTML/JS, Tailwind CLI for styles.
  - Backend: Node.js or Python, connect to Supabase and Anthropic.
- **Testing:**
  - Focus on manual testing for hackathon speed.
- **Debugging:**
  - Use browser devtools for extension/website.
  - Log API requests/responses for backend debugging.

## Integration Points
- **Supabase:**
  - Tables: `notes`, `mindmap_nodes`, `mindmap_edges`.
  - Mem0 stores embeddings and metadata here.
- **Mem0:**
  - Used for stateful memory, returns top-K relevant memories per query.
- **Anthropic:**
  - All calls proxied through backend, context includes memory, notes, mind map.

## Examples
- When user clicks "Remember this" in extension, push fact/trait to Mem0 and Supabase.
- On chat, backend queries Mem0 for top memories, fetches notes/mind map, and builds Anthropic prompt.

## Handoff Reminders
- Prioritize hackathon speed: working demo > polish.
- Keep code modular and minimal.
- Reference `plan.txt` for vision and architecture.
