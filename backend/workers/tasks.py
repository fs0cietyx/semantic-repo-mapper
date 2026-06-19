import os
import traceback
import threading
import json
from typing import Dict, Any, List

from backend.workers.celery_app import celery_app
from backend.api.database import SessionLocal
from backend.api import models
from backend.indexer.git_clone import RepositoryCloner
from backend.parsers.ast_parser import ASTParser
from backend.graph.neo4j_driver import Neo4jConnector
from backend.llm.summarizer import LLMSummarizer
from backend.graph.qdrant_driver import QdrantConnector
from backend.llm.embeddings import EmbeddingGenerator

@celery_app.task(name="backend.workers.tasks.index_repository_task")
def index_repository_task(repo_id: str, repo_url: str):
    """
    Background worker orchestrating the repository ingestion pipeline.
    Ensures correct driver attribute names and adds safety guards.
    """
    db = SessionLocal()
    neo4j_conn = Neo4jConnector()
    cloner = RepositoryCloner()
    parser = ASTParser()
    summarizer = LLMSummarizer(db=db)
    qdrant_conn = QdrantConnector()
    embedder = EmbeddingGenerator()

    # Fetch GitHub Token if available from PostgreSQL
    user_settings = db.query(models.UserSettings).first()
    token = user_settings.github_token if user_settings else None

    def update_status(status_str: str, progress_val: float, types: List[str] = None):
        db_repo = db.query(models.RepositoryMetadata).filter(models.RepositoryMetadata.id == repo_id).first()
        if db_repo:
            db_repo.status = status_str
            db_repo.progress = progress_val
            if types:
                db_repo.project_types = types
            db.commit()

    def log_task_step(step_name: str, task_status: str, log_msg: str):
        log = models.TaskLog(
            repo_id=repo_id,
            task_type=step_name,
            status=task_status,
            log_output=log_msg
        )
        db.add(log)
        db.commit()

    try:
        # Check if repository already has a successful indexing trace
        db_repo = db.query(models.RepositoryMetadata).filter(models.RepositoryMetadata.id == repo_id).first()
        is_incremental = False
        base_commit = None
        if db_repo and db_repo.status == "completed" and db_repo.last_indexed_commit:
            is_incremental = True
            base_commit = db_repo.last_indexed_commit

        local_path = None
        new_commit = None
        project_types = []
        files_to_parse = []
        is_fresh_indexing = not is_incremental

        if is_incremental:
            # --- INCREMENTAL MODE ---
            update_status("cloning", 10.0)
            log_task_step("clone", "running", f"Updating repository {repo_url} incrementally...")
            
            local_path = cloner.update_repository(repo_url, token=token)
            new_commit = cloner.get_latest_commit(local_path)
            
            if base_commit == new_commit:
                update_status("completed", 100.0)
                log_task_step("indexing", "completed", "Repository is already up to date. No new commits found.")
                return

            log_task_step("clone", "completed", f"Fetched repository updates. New HEAD: {new_commit}")
            
            # Find file diff
            diff = cloner.get_diff_files(local_path, base_commit, new_commit)
            added_files = diff["added"]
            modified_files = diff["modified"]
            deleted_files = diff["deleted"]
            
            log_task_step("parse", "running", f"Incremental updates: Added: {len(added_files)}, Modified: {len(modified_files)}, Deleted: {len(deleted_files)}")
            
            # 1. Clear deleted & modified files from databases
            files_to_delete = deleted_files + modified_files
            for file_path in files_to_delete:
                db_entities = db.query(models.CachedSummary).filter(
                    models.CachedSummary.repo_id == repo_id,
                    (models.CachedSummary.entity_path == file_path) |
                    (models.CachedSummary.entity_path.like(f"{file_path}::%"))
                ).all()
                
                paths_to_delete = [e.entity_path for e in db_entities]
                if paths_to_delete:
                    db.query(models.CachedSummary).filter(
                        models.CachedSummary.repo_id == repo_id,
                        models.CachedSummary.entity_path.in_(paths_to_delete)
                    ).delete(synchronize_session=False)
                    
                    db.query(models.ASTSymbol).filter(
                        models.ASTSymbol.repo_id == repo_id,
                        models.ASTSymbol.file_path.in_(paths_to_delete)
                    ).delete(synchronize_session=False)
                    
                    db.commit()
                    
                    if qdrant_conn and qdrant_conn.client:
                        qdrant_conn.delete_symbols_by_paths(repo_id, paths_to_delete)
                
                if neo4j_conn and neo4j_conn._driver:
                    neo4j_conn.delete_file_nodes(repo_id, file_path)
            
            files_to_parse = added_files + modified_files
            if not files_to_parse:
                db_repo = db.query(models.RepositoryMetadata).filter(models.RepositoryMetadata.id == repo_id).first()
                db_repo.last_indexed_commit = new_commit
                db_repo.status = "completed"
                db_repo.progress = 100.0
                db.commit()
                log_task_step("indexing", "completed", f"Incremental sync complete. Cleaned up {len(deleted_files)} deleted files.")
                return

            # Recreate parent folders recursively
            for file_path in files_to_parse:
                parts = file_path.split("/")
                for i in range(1, len(parts)):
                    folder_path = "/".join(parts[:i])
                    folder_name = parts[i-1]
                    parent_path = "/".join(parts[:i-1]) if i > 1 else None
                    if neo4j_conn and neo4j_conn._driver:
                        neo4j_conn.create_folder_node(
                            repo_id=repo_id,
                            path=folder_path,
                            name=folder_name,
                            parent_path=parent_path
                        )
        else:
            # --- FULL INDEXING MODE ---
            update_status("cloning", 10.0)
            log_task_step("clone", "running", f"Cloning repository {repo_url} from scratch...")
            
            if qdrant_conn and qdrant_conn.client:
                qdrant_conn.delete_repository_vectors(repo_id)
            
            local_path = cloner.clone_repository(repo_url, token=token)
            new_commit = cloner.get_latest_commit(local_path)
            
            project_types = cloner.detect_project_type(local_path)
            update_status("cloning", 25.0, types=project_types)
            log_task_step("clone", "completed", f"Repository cloned. Ecosystems: {project_types}")
            
            update_status("parsing", 30.0)
            log_task_step("parse", "running", "Scanning codebase file tree structure...")
            
            file_tree = cloner.build_file_tree(local_path)
            
            if neo4j_conn and neo4j_conn._driver:
                folders = [n for n in file_tree if n["type"] == "folder"]
                for folder in folders:
                    parent = folder.get("parent")
                    neo4j_conn.create_folder_node(
                        repo_id=repo_id,
                        path=folder["id"],
                        name=folder["name"],
                        parent_path=parent if parent else None
                    )
            
            files = [n for n in file_tree if n["type"] == "file"]
            files_to_parse = [f["id"] for f in files]

        # --- PARSING AND INGESTING SELECTED FILES ---
        parsed_files_data = {}
        for idx, file_path in enumerate(files_to_parse):
            parent_folder = "/".join(file_path.split("/")[:-1]) if "/" in file_path else None
            file_name = file_path.split("/")[-1]
            
            if neo4j_conn and neo4j_conn._driver:
                neo4j_conn.create_file_node(
                    repo_id=repo_id,
                    path=file_path,
                    name=file_name,
                    parent_folder_path=parent_folder if parent_folder else None
                )
            
            full_file_path = os.path.join(local_path, file_path)
            ast_data = parser.parse_file(full_file_path)
            
            if ast_data:
                parsed_files_data[file_path] = ast_data
                
                # Relational AST Unified Schema Caching
                for cls in ast_data.get("classes", []):
                    db.add(models.ASTSymbol(
                        repo_id=repo_id,
                        file_path=file_path,
                        symbol_name=cls["name"],
                        symbol_type="class",
                        line_start=cls["range"][0],
                        line_end=cls["range"][1],
                        attributes={"extends": cls.get("extends", [])}
                    ))
                for func in ast_data.get("functions", []):
                    db.add(models.ASTSymbol(
                        repo_id=repo_id,
                        file_path=file_path,
                        symbol_name=func["name"],
                        symbol_type="function",
                        line_start=func["range"][0],
                        line_end=func["range"][1],
                        attributes={"args": func.get("args", [])}
                    ))
                for imp in ast_data.get("imports", []):
                    db.add(models.ASTSymbol(
                        repo_id=repo_id,
                        file_path=file_path,
                        symbol_name=imp.get("statement", "")[:255],
                        symbol_type=imp.get("type", "import"),
                        line_start=imp["range"][0] if "range" in imp else None,
                        line_end=imp["range"][1] if "range" in imp else None
                    ))
                db.commit()

                if neo4j_conn and neo4j_conn._driver:
                    # Heuristic to generate Friendly Names
                    def make_friendly(name: str, symbol_type: str) -> str:
                        clean_name = name.replace("_", " ").replace("-", " ")
                        # Add spaces before capital letters (camelCase to Title Case)
                        clean_name = ''.join([' ' + c if c.isupper() else c for c in clean_name]).strip().title()
                        if symbol_type == "Class":
                            return f"{clean_name} Model" if "Model" not in clean_name else clean_name
                        if symbol_type == "Function" or symbol_type == "Method":
                            if clean_name.startswith("Get ") or clean_name.startswith("Fetch "): return f"Retrieve {clean_name[4:]}"
                            if clean_name.startswith("Set ") or clean_name.startswith("Update "): return f"Modify {clean_name[4:]}"
                            return f"{clean_name} Handler"
                        return clean_name

                    # 1. Create Class nodes
                    for cls in ast_data.get("classes", []):
                        neo4j_conn.create_symbol_node(
                            repo_id=repo_id,
                            file_path=file_path,
                            symbol_type="Class",
                            name=cls["name"],
                            props={"extends": cls["extends"], "range": cls["range"], "friendly_name": make_friendly(cls["name"], "Class")}
                        )
                    
                    # 2. Create Function nodes (distinguishing Methods if in class)
                    for func in ast_data.get("functions", []):
                        parent_class = None
                        for cls in ast_data.get("classes", []):
                            if func["range"][0] >= cls["range"][0] and func["range"][1] <= cls["range"][1]:
                                parent_class = cls["name"]
                                break
                        
                        symbol_type = "Method" if parent_class else "Function"
                        neo4j_conn.create_symbol_node(
                            repo_id=repo_id,
                            file_path=file_path,
                            symbol_type=symbol_type,
                            name=func["name"],
                            props={"class_name": parent_class, "args": func.get("args", []), "range": func["range"], "friendly_name": make_friendly(func["name"], symbol_type)}
                        )

                    # 3. Create APIEndpoint nodes
                    for ep in ast_data.get("api_endpoints", []):
                        neo4j_conn.create_symbol_node(
                            repo_id=repo_id,
                            file_path=file_path,
                            symbol_type="APIEndpoint",
                            name=f"{ep['method']} {ep['path']}",
                            props={"method": ep["method"], "path": ep["path"], "range": ep["range"], "friendly_name": f"{ep['method']} Route: {ep['path']}"}
                        )

                    # 4. Create DatabaseModel nodes
                    for model in ast_data.get("db_models", []):
                        neo4j_conn.create_symbol_node(
                            repo_id=repo_id,
                            file_path=file_path,
                            symbol_type="DatabaseModel",
                            name=model["name"],
                            props={"range": model["range"], "friendly_name": f"{make_friendly(model['name'], 'Class')} Database Record"}
                        )

                    # 5. Create Hook nodes
                    for hook in ast_data.get("hooks", []):
                        neo4j_conn.create_symbol_node(
                            repo_id=repo_id,
                            file_path=file_path,
                            symbol_type="Hook",
                            name=hook["name"],
                            props={"range": hook["range"], "friendly_name": f"React Hook: {make_friendly(hook['name'], 'Hook')}"}
                        )
            
            prog_inc = 30.0 + (float(idx + 1) / (len(files_to_parse) or 1)) * 40.0
            update_status("parsing", round(prog_inc, 1))

        log_task_step("parse", "completed", f"Parsed syntax structures for {len(parsed_files_data)} files.")

        # --- PHASE 2.5: SEMANTIC SUMMARIZATION & VECTOR EMBEDDINGS ---
        update_status("summarizing", 70.0)
        log_task_step("summarize", "running", "Generating semantic AI summaries and vector embeddings...")
        
        batch_size = 15
        all_file_paths = list(parsed_files_data.keys())
        
        for i in range(0, len(all_file_paths), batch_size):
            batch_paths = all_file_paths[i:i+batch_size]
            batch_data = []
            
            for file_path in batch_paths:
                data = parsed_files_data[file_path]
                batch_data.append({
                    "file_path": file_path,
                    "imports": [imp.get("name", "") for imp in data.get("imports", [])],
                    "classes": [{"name": c["name"]} for c in data.get("classes", [])],
                    "functions": [f["name"] for f in data.get("functions", [])]
                })
                
            batch_summaries = {}
            if summarizer:
                batch_summaries = summarizer.generate_batch_file_summaries(batch_data)
                
            for file_path in batch_paths:
                summary = batch_summaries.get(file_path, f"Parsed structure for {file_path.split('/')[-1]}")
                
                db_summary = models.CachedSummary(
                    repo_id=repo_id,
                    entity_path=file_path,
                    entity_type="file",
                    summary=summary
                )
                db.add(db_summary)
                
                if embedder and qdrant_conn and qdrant_conn.client:
                    vector = embedder.generate_embedding(summary)
                    if vector:
                        qdrant_conn.upsert_symbol(
                            repo_id=repo_id,
                            entity_path=file_path,
                            name=file_path.split("/")[-1],
                            entity_type="file",
                            summary=summary,
                            vector=vector
                        )                        
        db.commit()
        
        # --- PHASE 3: RESOLVE RELATIONSHIPS ---
        update_status("indexing", 85.0)
        log_task_step("indexing", "running", "Resolving dependency import and call paths...")

        if neo4j_conn and neo4j_conn._driver:
            # 1. Resolve IMPORTS and EXPORTS
            for file_path, data in parsed_files_data.items():
                for imp in data.get("imports", []):
                    # Try to resolve import to a local file
                    stmt = imp["statement"]
                    # Simple heuristic: look for file names in the import statement
                    for target_path in parsed_files_data.keys():
                        target_name = target_path.split("/")[-1].split(".")[0]
                        if target_name in stmt and target_path != file_path:
                            neo4j_conn.create_relationship(repo_id, file_path, target_path, "IMPORTS")
                            break
            
            # 2. Resolve EXTENDS (Inheritance)
            for file_path, data in parsed_files_data.items():
                for cls in data.get("classes", []):
                    class_id = f"{file_path}::{cls['name']}"
                    for base_name in cls.get("extends", []):
                        # Search for the base class in other files
                        for other_file, other_data in parsed_files_data.items():
                            for other_cls in other_data.get("classes", []):
                                if other_cls["name"] == base_name:
                                    neo4j_conn.create_relationship(repo_id, class_id, f"{other_file}::{base_name}", "EXTENDS")
                                    break

            # 3. Resolve CALLS (Function/Method Invocation)
            for file_path, data in parsed_files_data.items():
                # Map calls to functions within the same file or across imports
                for func in data.get("functions", []):
                    parent_class = None
                    for cls in data.get("classes", []):
                        if func["range"][0] >= cls["range"][0] and func["range"][1] <= cls["range"][1]:
                            parent_class = cls["name"]
                            break
                    
                    prefix = f"{file_path}::{parent_class}::" if parent_class else f"{file_path}::"
                    caller_id = f"{prefix}{func['name']}"
                    
                    # Extract calls inside this function
                    inner_calls = parser.parse_function_flow(os.path.join(local_path, file_path), func["name"])
                    for call in inner_calls:
                        target_name = call["target"]
                        # Heuristic: search for function/method nodes with this name
                        # (Optimized by checking current file first, then globally)
                        resolved = False
                        # Check current file
                        for f in data.get("functions", []):
                            if f["name"] == target_name:
                                # Determine target id
                                t_class = None
                                for c in data.get("classes", []):
                                    if f["range"][0] >= c["range"][0] and f["range"][1] <= c["range"][1]:
                                        t_class = c["name"]
                                        break
                                t_prefix = f"{file_path}::{t_class}::" if t_class else f"{file_path}::"
                                target_id = f"{t_prefix}{target_name}"
                                if caller_id != target_id:
                                    neo4j_conn.create_relationship(repo_id, caller_id, target_id, "CALLS")
                                resolved = True
                                break
                        
                        if not resolved:
                            # Global search (expensive but necessary for static analysis)
                            # To be optimized with a symbol index
                            pass
            
            # 4. Resolve ROUTES_TO (API Endpoint to Handler)
            # (Mapping routes to the functions they wrap or call)
            for file_path, data in parsed_files_data.items():
                for ep in data.get("api_endpoints", []):
                    ep_id = f"{file_path}::{ep['method']} {ep['path']}"
                    # Find function defined at the same range (handler)
                    for func in data.get("functions", []):
                        if func["range"][0] == ep["range"][0] or func["range"][0] == ep["range"][0] + 1:
                            neo4j_conn.create_relationship(repo_id, ep_id, f"{file_path}::{func['name']}", "ROUTES_TO")
                            break

        # --- PHASE 4: AI INTELLIGENCE PULSE ---
        update_status("analyzing", 90.0)
        log_task_step("ai_analysis", "running", "Generating semantic clusters and recruiter intelligence...")

        if summarizer:
            # 1. Gather node summaries for clustering
            node_summaries = []
            summaries = db.query(models.CachedSummary).filter(models.CachedSummary.repo_id == repo_id).all()
            for s in summaries:
                node_summaries.append({"id": s.entity_path, "summary": s.summary})

            # 2. Cluster into Semantic Domains
            repo_desc = db_repo.description or ""
            domains = summarizer.cluster_semantic_domains(repo_desc, node_summaries)
            
            if neo4j_conn and neo4j_conn._driver:
                for dom in domains:
                    domain_id = f"domain:{dom['name'].lower().replace(' ', '_')}"
                    # Create Domain Node
                    neo4j_conn.create_node(repo_id, "SemanticDomain", {
                        "id": domain_id,
                        "name": dom["name"],
                        "summary": dom["description"],
                        "type": "domain"
                    })
                    # Link to Repo
                    neo4j_conn.create_relationship(repo_id, repo_id, domain_id, "CONTAINS")
                    
                    # Link Member Nodes
                    for member_id in dom.get("nodes", []):
                        neo4j_conn.create_relationship(repo_id, domain_id, member_id, "CONTAINS")

            # 3. Generate High-Level Non-Technical Repository Description
            readme_content = ""
            for file_path in parsed_files_data.keys():
                if file_path.lower().endswith("readme.md"):
                    try:
                        with open(os.path.join(local_path, file_path), "r", encoding="utf-8") as f:
                            readme_content = f.read()
                        break
                    except Exception:
                        pass
            
            repo_desc = summarizer.generate_repository_summary(readme_content, node_summaries)
            db_repo.description = repo_desc
            db_repo.project_types = list(set(db_repo.project_types + ["AI_ANALYZED"]))
            log_task_step("repo_summary", "completed", "Generated non-technical repository map description.")

        # Finalize
        db_repo = db.query(models.RepositoryMetadata).filter(models.RepositoryMetadata.id == repo_id).first()
        if db_repo:
            db_repo.last_indexed_commit = new_commit
            db_repo.status = "completed"
            db_repo.progress = 100.0
            db.commit()

        log_task_step("indexing", "completed", "Repository sync completed successfully.")

    except Exception as e:
        err_msg = f"Task failed: {str(e)}\n{traceback.format_exc()}"
        print(err_msg)
        update_status("failed", 100.0)
        log_task_step("indexing", "failed", err_msg)
    finally:
        db.close()
        if neo4j_conn:
            neo4j_conn.close()
