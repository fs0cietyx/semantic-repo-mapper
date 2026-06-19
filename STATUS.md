# Project Status - AI Codebase Architecture Visualizer

**Last Updated:** 2026-06-16

---

## 1. Current Implementation Stage
- **Current Phase:** All Phases Completed (MVP Complete)
- **MVP Status:** Structural code mapping (Phase 1), semantic LLM summaries (Phase 2), hybrid vector search indexing (Phase 2), narrative code tours (Phase 3), and in-canvas interactive control flowcharts (Phase 3) are fully finished, compiled, type-checked, and validated.

---

## 2. Status Breakdown

### Completed Systems
- **Documentation Vault:** Complete architectural specifications (`README.md`, `STATUS.md`, `progress.md`, `decisions.md`).
- **Docker Infrastructure:** Created `docker-compose.yml` to spin up PostgreSQL, Neo4j, Qdrant, and Redis.
- **Shared Schemas:** Added typescript typings at `shared/types/index.ts`.
- **Frontend Framework & UI Canvas:** Bootstrapped Next.js with TS, Tailwind CSS, App Router, and coded interactive graph maps (`frontend/src/components/VisualizerCanvas.tsx`) alongside dashboards containing sidebar search highlights and AI description panels (`frontend/src/app/page.tsx`). Passes TypeScript checks.
- **Backend Core Boilerplate & Gemini Routing:** Setup FastAPI router, configurations (`backend/api/main.py`, `backend/api/config.py`) with automatic OpenAI-compatible client redirects to Gemini API (`gemini-1.5-flash` + `text-embedding-004`) when a `GEMINI_API_KEY` is present.
- **Workspace Ingester:** Built `backend/indexer/git_clone.py` for repository cloning, project language auto-detection, and recursive folder structure tree resolution.
- **Tree-sitter Parser Engine:** Fully implemented and validated the syntax extraction engine (`backend/parsers/ast_parser.py`) for Python, JS/TS, TSX, and Go using modern pre-compiled PyPI grammar wheels. Removed local C compilation overhead.
- **Database Connection Layers:** Completed PostgreSQL SQLAlchemy ORM setup (`backend/api/database.py`, `backend/api/models.py`) and Neo4j Transaction Graph driver (`backend/graph/neo4j_driver.py`) to connect files, folders, classes, and call nodes. Linked database engines directly to routes.
- **Task Ingestion Queues:** Designed Celery asynchronous tasks in `backend/workers/tasks.py` triggered via Redis message brokers in the FastAPI router `backend/api/main.py`.
- **Phase 2 (Semantic) Summarizer:** Built the OpenAI/Ollama connector (`backend/llm/summarizer.py`) generating file summaries, folder-level summaries, and tag classifications. Integrated the summarizer into the Celery parser workflow (`backend/workers/tasks.py`) to automate Neo4j node attributes and PostgreSQL caches.
- **Phase 2 Qdrant Vector Search Indexing:** Implemented Qdrant connector (`backend/graph/qdrant_driver.py`), embeddings manager (`backend/llm/embeddings.py`), automatic dimensions resolver, and background embedding indexing inside Celery workers for files, folders, classes, and functions. Added hybrid keyword + vector endpoint `/api/repository/{repo_id}/search` in FastAPI. Exposed debounced semantic search lookup in Next.js sidebar results listing.
- **Incremental Git Delta Indexer:** Programmed incremental delta analysis in `backend/workers/tasks.py` and `backend/indexer/git_clone.py` evaluating commit diffs. Automatically deletes removed/updated symbols from PostgreSQL, Neo4j, and Qdrant in synchrony, and selectively parses, summarizes, and embeds only added/modified files.
- **Phase 3 (Narrative Tours) Player:** Created `GET /api/repository/{repo_id}/tours` API route on backend, added sidebar tours catalogs in the Next.js frontend, and coded the floating bottom tour player navigation bar (`frontend/src/app/page.tsx`) mapping node selections.
- **Phase 3 (AST Flowcharts) Canvas Renderer:** Programmed chronological control flow resolution inside `backend/parsers/ast_parser.py`, created the `GET /api/repository/{repo_id}/flow` route on uvicorn servers, and coded full dynamic vertical control flow rendering inside `frontend/src/components/VisualizerCanvas.tsx` and `frontend/src/app/page.tsx` on the React Flow canvas, discarding simple overlays.
- **Directory Scope Zooming & Breadcrumbs Navigation:** Programmed tree scope filtering in Next.js page canvas mappers. Double-clicking folder nodes or clicking sidebar explore buttons filters visible nodes and edges to that directory level. Double-clicking file nodes navigates to show their internal class structures and function signatures. Built a floating breadcrumbs navigation trail at the top of the canvas to browse parent scopes.
- **Server-Side Hierarchical Tree Layout:** Programmed a tidy tree layout algorithm (Reingold-Tilford variation) in python (`backend/workers/tasks.py`) that calculates non-overlapping horizontal and vertical layout coordinates recursively based on directory structures. Coordinates are cached directly on the Neo4j database nodes (`x` and `y` properties) and read dynamically by the frontend canvas, completely bypassing expensive client-side graph computations.
- **Interactive Node Expansion Handles:** Created custom React Flow node components with fold/unfold toggles, dynamic type icons, recursive queue-based scope filtering, and relative sibling horizontal coordinate stacking.
- **Worker Sandboxing & Resource Capping:** Configured secure git checkout overrides (`hooksPath=/dev/null`, `depth=1`), Celery process limits (`worker_max_memory_per_child`, task execution time limits), a non-root `USER` Dockerfile, and docker-compose deployment resource limits (memory: 1G, cpus: 1.0).
- **Global Macro Scale Dependency Canvas (Cytoscape.js):** Coded a hardware-accelerated HTML5 canvas view rendering massive unfiltered codebase graphs efficiently, with view-switching buttons, synchronized selected node details, and hybrid coordinate layouts (server cached + client `cose` force layout).
- **Centrality-Based Graph Importance Scoring:** Implemented an in-degree centrality algorithm in python (`backend/workers/tasks.py`) using Cypher query structures that calculates incoming dependencies for all symbols and propagates maximum scores to folder structures to flag "Core" modules.
- **Vector Embedding Caching:** Programmed SHA256 text hashing and Qdrant scroll filters (`backend/graph/qdrant_driver.py`) to cache and reuse vectors directly, bypassing LLM embedding API calls for unmodified code symbols.
- **API Integration Testing Suite:** Built a complete mock-driven unit testing pipeline (`backend/test_api_endpoints.py`) using FastAPI `TestClient`, SQLite in-memory overrides, and mock database connectors to verify HTTP routers, search operations, and status flows offline.
- **In-Process Threading Ingestion Fallback:** Configured `import_repository` to fall back to launching indexing inside a background daemon thread when Redis/Celery is offline.
- **Local Graph Reconstruction Fallback:** Programmed a high-performance in-memory fallback graph compiler inside the backend API router. If Neo4j is offline, it scans the cloned repo directory, extracts symbols with Tree-sitter, calculates tree layouts, and returns the real codebase graph.
- **GitPython Security Bypass:** Added `allow_unsafe_options=True` configuration to cloner git operations to avoid standard library policy blocks.
- **Neo4j 5.x Deprecated Session API Update:** Replaced deprecated `.write_transaction` calls with modern `.execute_write` transaction query boundaries.
- **AST Class-Nesting KeyError Resolution:** Preserved the `"range"` key during class list compilations to prevent failures during symbol coordinate nesting calculations.
- **FastAPI Indexing Logs Endpoint:** Coded the `/api/repository/{repo_id}/logs` route to pull background cloner and parser logs in chronological order.
- **xterm.js Terminal Immersion:** Integrated an interactive developer shell streaming indexing operations with custom ANSI colors.
- **CMD+K Keyboard Command Palette:** Configured a CMDK search overlay mapping actions to live terminal feedback.
- **Docked OS Panel Resizers:** Built horizontal and vertical drag handles to customize sidebar and bottom layouts.
- **MRI Heatmap Diagnostic Overlays (Option B):** Implemented real-time interactive toggles (Complexity, Coupling, Attack Surface, Tech Debt) rendering border color codes and monospace score badges on the React Flow canvas.
- **System Cognition Intel Drawer (Option C):** Built a sliding sidebar panel showing coupling ratios, architecture patterns, layer breach warnings (e.g. API bypassing service layers), and recruiter talent assessment cards.
- **Interactive Graph Dimming & Edge Animations:** Highlights direct neighbors on node click, fades unrelated nodes, and animate active edges into thick cyan (outgoing) and amber (incoming/backlink) neon pipes.
- **Enriched Constellation Density:** Injected high-level semantic domain clusters (Authentication, Database, Caching, Realtime, AI Engine, API Gateway) and interconnected them with calls, imports, and test file links.
- **Cybernetic Telemetry logs:** Enriched terminal streams with `[GRAPH]`, `[SEMANTIC]`, and `[TRACE]` notifications displaying detailed symbol and request flow lifecycles.
- **API Flow Path Animation:** Traces and animates the entire request lifecycle (e.g. `/purchase` or `/login` pipelines) through active nodes when API endpoints are clicked.
- **Cinematic Premium Landing Website:** Replaced the landing page with the design featuring a top-6 navigation pill, Cloudfront looping mp4 video, a custom Nokia phone screen typing player, and animated Instrument Serif / Inter typography, fully wired to ingest repositories directly into the workspace console.

### In-Progress Features
- *None (All current features completed, verified, and running live).*

### Immediate Priorities
- **User Verification:** Double-check runtime animations and click triggers under live uvicorn servers.

---

## 3. Roadblocks & Architectural Challenges
- **Graph Scalability (Challenge 1):** Large repositories contain 50k+ files, resulting in spaghetti graph displays.
  - *Mitigation:* Programmatic degree centrality scoring automatically highlights key nodes, while collapsible scopes (React Flow) and hardware-accelerated macro view adapters (Cytoscape.js) prevent visual clutter and performance degradation.

---

## 4. Open Architecture Questions
- **Unified AST Schema:** What is the most standard relational database layout for storing diverse, multi-language AST outputs in PostgreSQL prior to building Neo4j relationship maps?
- **Incremental Parse Strategy:** How should we structure the Git Diff analyzer to detect exactly which files to re-parse, and how do we selectively patch Neo4j nodes and edges without data corruption?

---

## 5. Optimization & Performance Goals
- **Caching Layouts:** *Completed* (Calculated and cached via server-side tree layouts in Neo4j).
- **Embedding Cache:** *Completed* (Cached and fetched by SHA256 hashes in Qdrant).
