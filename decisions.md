# Architecture Decisions - AI Codebase Architecture Visualizer

This document tracks all high-impact design and technical choices made throughout the project lifetime.

---

## ADR 001: Static Analysis First, LLM Semantic Summarization Second

- **Status:** Approved
- **Date:** 2026-06-16

### Context
Understanding a large codebase requires accurate, high-fidelity mapping of symbols, imports, and dependencies. Calling LLMs on entire files or folders to extract structure is highly expensive, slow, prone to hallucinated dependencies, and limited by context window sizes.

### Chosen Solution
Rely strictly on deterministic static analysis (via Tree-sitter AST parsing) to construct the structure of the repository (classes, functions, call graphs, imports). Use local LLMs (via Ollama) only to read specific symbols or modules and generate high-level semantic descriptions.

### Alternatives Considered
1. **LLM-Only Code Understanding (e.g., Vector RAG):** Using chunking and vector embeddings to search code, then prompting the LLM to explain relationships on the fly.
2. **Purely Deterministic Indexing:** Building a standard language server index without any AI-assisted explanation features.

### Rationale
- **Accuracy:** AST parsing guarantees 100% accurate file-to-file and function-to-function boundaries.
- **Cost:** Avoids massive token usage on external APIs.
- **Speed:** Indexing is computationally fast; semantic summarization can be processed asynchronously or on-demand.

### Tradeoffs
- Parsing complex dynamic imports in dynamically-typed languages (e.g., Python, JavaScript) can sometimes be ambiguous under static analysis alone compared to dynamic trace-based resolution.

### Revisit Conditions
- If dynamic language features become impossible to resolve statically to an acceptable level of precision, we may introduce dynamic tracing capabilities (e.g., parsing execution traces/logs).

---

## ADR 002: Hybrid Database Model (PostgreSQL + Neo4j + Redis)

- **Status:** Approved
- **Date:** 2026-06-16

### Context
The visualizer needs to manage multiple types of data:
1. **Metadata:** User preferences, repository source URL, user permissions, indexing status.
2. **Graph Structure:** Class hierarchies, call chains, package-to-package dependency paths.
3. **Cache:** Tokenized AST outputs, LLM-generated summaries.

### Chosen Solution
A hybrid storage architecture utilizing:
- **PostgreSQL** for relational metadata and persistent configurations.
- **Neo4j** to store the rich, traversable code dependency graphs.
- **Redis** as a fast transient layer for AST caching and LLM completion caching.

### Alternatives Considered
1. **PostgreSQL Only:** Using relational tables and recursive Common Table Expressions (CTEs) or JSONB structures to represent the graph.
2. **Neo4j Only:** Storing metadata and caching inside Neo4j node properties.

### Rationale
- Relational databases are highly efficient for users, repo status logs, and transactions.
- Graph databases are designed to handle complex traversals (e.g., transitive dependencies, path search) with sub-millisecond lookups.
- Redis allows AST caches to be shared instantly across different runs of the indexing engine without database write overhead.

### Tradeoffs
- Multi-database setups increase local development setup complexity and operational maintenance overhead.

### Revisit Conditions
- If the system complexity becomes too high for local running, we may evaluate consolidated database options (e.g., using PostgreSQL with `pg_routing` or AGE extension for graphs).

---

## ADR 003: Multi-Language Parsing Strategy via Tree-sitter

- **Status:** Approved
- **Date:** 2026-06-16

### Context
The system needs to ingest repositories in multiple target languages (Node.js/TypeScript, Python, Go, Rust, Java). Maintaining custom regex patterns or custom language AST parsers is fragile and fails on modern syntax extensions.

### Chosen Solution
Use **Tree-sitter** as the unified code parser. Since `tree-sitter>=0.22`, we import pre-compiled language grammar wheels directly from PyPI (e.g., `tree-sitter-python`, `tree-sitter-typescript`) rather than compiling C libraries locally.

### Alternatives Considered
1. **Language-Specific AST libraries (e.g., Python's `ast`, JS `typescript` compiler APIs):** Run multi-process indexing microservices in separate runtimes.
2. **Regex/Lexer Heuristics (e.g., Pygments):** High-speed pattern parsing without full syntax understanding.
3. **Local C Compilation (`build_library`):** Clones grammar repositories and compiles them during setup (deprecated in newer versions).

### Rationale
- **Performance:** Tree-sitter is written in C, making it extremely fast.
- **Zero Local Compilation:** Using PyPI-distributed precompiled grammar wheels avoids needing local compilation chains (gcc/clang) during production deployment and local development setup.
- **Incremental Analysis:** Tree-sitter supports incremental parsing of modified sub-trees out of the box.
- **Standardization:** All languages output a unified Concrete Syntax Tree (CST) pattern, simplifying the backend mapper layer.

### Tradeoffs
- Relying on PyPI packages means we depend on the community maintaining up-to-date compiled binaries for target languages. If a niche language grammar is needed, we would have to compile it manually.

### Revisit Conditions
- If PyPI packages for key languages fall out of sync with official Tree-sitter core updates, or if we need support for a custom grammar not published to PyPI.

---

## ADR 004: Frontend Visual Graph Libraries (React Flow & Cytoscape.js)

- **Status:** Approved
- **Date:** 2026-06-16

### Context
Displaying codebase structures requires rendering graphs of varying scale. High-level package dependencies might consist of 20-50 nodes, whereas a complete call graph of a monolith repository can scale up to 10,000+ nodes.

### Chosen Solution
Use a **hybrid rendering strategy**:
- **React Flow** for rendering sub-system maps, file detail view nodes, flowchart pipelines, and narrative code tours.
- **Cytoscape.js** for showing global macro dependency graphs with large node counts.

### Alternatives Considered
1. **React Flow Only:** Fast UI integration but suffers performance drops on SVG rendering when graphs exceed 500 nodes.
2. **Cytoscape.js Only:** Performant canvas rendering but lacks native React state/component injection interfaces.
3. **D3.js Custom Canvas:** High developer overhead for boilerplate node rendering.

### Rationale
- React Flow offers a premium UI/UX experience, supporting HTML/React component rendering inside nodes, which is essential for rich, custom AI info panels and clickable interactive triggers.
- Cytoscape.js uses a raw HTML5 canvas rendering pipeline, meaning it can draw and lay out thousands of elements with smooth 60fps pan/zoom.

### Tradeoffs
- Requires maintaining two separate graphing adapters and serialization formats in the frontend codebase.

### Revisit Conditions
- If React Flow implements canvas rendering natively in future versions, or if double rendering layers create too much codebase complexity.

---

## ADR 005: Hybrid Search Architecture (Keyword + Vector + Graph Traversal)

- **Status:** Approved
- **Date:** 2026-06-16

### Context
Users search repositories with query intents ranging from literal syntax matching (`"validateCredentials()"`) to conceptual semantic intents (`"Where is the session token validated?"`).

### Chosen Solution
Implement a **three-tiered hybrid search engine**:
1. **Keyword Search (FlexSearch / Postgres FTS):** Resolves exact matches of variable names, files, and classes.
2. **Vector Search (Qdrant + Jina Code Embeddings):** Resolves semantic queries by mapping the query embedding to code-symbol vector indexes.
3. **Graph Traversal (Neo4j):** Explores relationships, tracing from matched functions up to their API endpoints or down to database tables.

### Alternatives Considered
1. **Pure Vector Search (RAG):** Easy to set up but fails at finding exact symbol declarations or tracing structural call graphs.
2. **Neo4j Full-Text Indexing Only:** Fast for relationships, but poor performance on semantic/conceptual mapping.

### Rationale
- Provides a comprehensive search interface where user queries can find conceptual blocks, highlight them visually on the map, and display their upstream and downstream dependency impacts.

### Tradeoffs
- High retrieval orchestration complexity, requiring merging and ranking scoring rules across keyword engines, vector distance rankings, and graph depths.

### Revisit Conditions
- When query latency exceeds acceptable interactive search thresholds (e.g., >200ms response time).
