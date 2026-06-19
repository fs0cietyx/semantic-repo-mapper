from typing import List, Dict, Any, Optional
from neo4j import GraphDatabase, Driver
from backend.api.config import settings

class Neo4jConnector:
    """Manages connection and Cypher query executions for Neo4j database."""
    
    def __init__(self):
        self._driver: Optional[Driver] = None
        try:
            self._driver = GraphDatabase.driver(
                settings.NEO4J_URI, 
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            self._verify_connection()
        except Exception as e:
            print(f"Failed to initialize Neo4j connection: {e}")
            if self._driver:
                try:
                    self._driver.close()
                except Exception:
                    pass
            self._driver = None

    def _verify_connection(self):
        """Checks if the connection is active and creates database indexes for the Software Nervous System."""
        if not self._driver:
            return
        with self._driver.session() as session:
            # Check basic connection
            session.run("RETURN 1")
            
            # Create constraints/indexes for 15 Node Types
            node_types = [
                "Repository", "Folder", "File", "Class", "Function", 
                "Method", "APIEndpoint", "DatabaseModel", "Middleware", 
                "Hook", "Queue", "Event", "Service", "SemanticDomain", "InfrastructureNode"
            ]
            
            for node_type in node_types:
                # Use id and repo_id as a unique compound key (modeled as properties)
                # Note: Cypher doesn't allow dynamic labels in CREATE CONSTRAINT, but we can loop
                query = f"CREATE CONSTRAINT unique_{node_type.lower()}_id IF NOT EXISTS FOR (n:{node_type}) REQUIRE (n.id, n.repo_id) IS UNIQUE"
                if node_type == "Repository":
                    query = "CREATE CONSTRAINT unique_repository_id IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE"
                
                try:
                    session.run(query)
                except Exception as e:
                    print(f"Warning: Could not create constraint for {node_type}: {e}")

            # Add general indexes for performance
            session.run("CREATE INDEX node_type_index IF NOT EXISTS FOR (n) ON (n.type)")
            session.run("CREATE INDEX repo_id_index IF NOT EXISTS FOR (n) ON (n.repo_id)")

    def close(self):
        """Closes active driver connection."""
        if self._driver:
            self._driver.close()

    def clear_repository_graph(self, repo_id: str):
        """Deletes all nodes and relationships associated with a repository ID."""
        if not self._driver:
            return
        query = """
        MATCH (n {repo_id: $repo_id})
        DETACH DELETE n
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(query, repo_id=repo_id))

    def create_node(self, repo_id: str, label: str, properties: Dict[str, Any]):
        """Generic method to create any of the 15 node types with standardized metadata."""
        if not self._driver:
            return
        
        # Standardize properties
        properties["repo_id"] = repo_id
        if "id" not in properties:
            # Fallback ID generation if not provided
            properties["id"] = f"{repo_id}:{label.lower()}:{properties.get('name', 'unnamed')}"

        query = f"""
        MERGE (n:{label} {{id: $id, repo_id: $repo_id}})
        SET n += $props
        RETURN n
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(query, id=properties["id"], repo_id=repo_id, props=properties))

    def create_relationship(self, repo_id: str, from_id: str, to_id: str, rel_type: str, props: Dict[str, Any] = None):
        """Generic method to create any relationship type."""
        if not self._driver:
            return
        
        query = f"""
        MATCH (a {{id: $from_id, repo_id: $repo_id}})
        MATCH (b {{id: $to_id, repo_id: $repo_id}})
        MERGE (a)-[r:{rel_type}]->(b)
        SET r += $props
        RETURN r
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(
                query, repo_id=repo_id, from_id=from_id, to_id=to_id, props=props or {}
            ))

    def create_repository_node(self, repo_id: str, repo_url: str, metadata: Dict[str, Any] = None):
        """Creates the root Repository node with rich metadata."""
        props = {
            "id": repo_id,
            "url": repo_url,
            "created_at": metadata.get("created_at") if metadata else None,
            "description": metadata.get("description") if metadata else None,
            "stars": metadata.get("stars", 0),
            "type": "Repository"
        }
        self.create_node(repo_id, "Repository", props)

    def create_folder_node(self, repo_id: str, path: str, name: str, parent_path: Optional[str] = None):
        """Creates a Folder node and connects it to its parent."""
        self.create_node(repo_id, "Folder", {"id": path, "name": name, "type": "folder"})
        if parent_path:
            self.create_relationship(repo_id, parent_path, path, "CONTAINS")
        else:
            self.create_relationship(repo_id, repo_id, path, "CONTAINS")

    def create_file_node(self, repo_id: str, path: str, name: str, parent_folder_path: Optional[str] = None):
        """Creates a File node and connects it to its parent."""
        self.create_node(repo_id, "File", {"id": path, "name": name, "type": "file"})
        if parent_folder_path:
            self.create_relationship(repo_id, parent_folder_path, path, "CONTAINS")
        else:
            self.create_relationship(repo_id, repo_id, path, "CONTAINS")

    # Higher-level convenience wrappers for the dense graph
    def create_symbol_node(self, repo_id: str, file_path: str, symbol_type: str, name: str, props: Dict[str, Any] = None):
        """Creates logic nodes (Class, Function, Method, Hook, etc.) and links to container."""
        symbol_id = f"{file_path}::{name}"
        if symbol_type == "Method" and props.get("class_name"):
            symbol_id = f"{file_path}::{props['class_name']}::{name}"
        
        properties = props or {}
        properties.update({"id": symbol_id, "name": name, "type": symbol_type.lower()})
        
        self.create_node(repo_id, symbol_type, properties)
        self.create_relationship(repo_id, file_path, symbol_id, "CONTAINS")
        return symbol_id

    def create_import_relationship(self, repo_id: str, from_path: str, to_path: str):
        """Creates an IMPORTS relationship between two file paths."""
        if not self._driver:
            return
        query = """
        MATCH (from_file:File {id: $from_path, repo_id: $repo_id})
        MATCH (to_file:File {id: $to_path, repo_id: $repo_id})
        MERGE (from_file)-[:IMPORTS]->(to_file)
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(
                query, repo_id=repo_id, from_path=from_path, to_path=to_path
            ))

    def create_class_node(self, repo_id: str, file_path: str, class_name: str, extends_list: List[str] = None):
        """Creates a Class node, links it to its container file, and sets inheritances."""
        if not self._driver:
            return
        class_id = f"{file_path}::{class_name}"
        
        query_class = """
        MERGE (c:Class {id: $class_id, repo_id: $repo_id})
        SET c.name = $class_name, c.extends = $extends
        """
        query_link = """
        MATCH (c:Class {id: $class_id, repo_id: $repo_id})
        MATCH (f:File {id: $file_path, repo_id: $repo_id})
        MERGE (f)-[:DEFINES]->(c)
        """
        
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(
                query_class, repo_id=repo_id, class_id=class_id, class_name=class_name, extends=extends_list or []
            ))
            session.execute_write(lambda tx: tx.run(
                query_link, repo_id=repo_id, class_id=class_id, file_path=file_path
            ))

    def create_function_node(self, repo_id: str, file_path: str, func_name: str, class_name: Optional[str] = None):
        """Creates a Function node and links it to either its parent Class or container File."""
        if not self._driver:
            return
        
        prefix = f"{file_path}::{class_name}::" if class_name else f"{file_path}::"
        func_id = f"{prefix}{func_name}"
        
        query_func = """
        MERGE (f:Function {id: $func_id, repo_id: $repo_id})
        SET f.name = $func_name
        """
        
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(query_func, repo_id=repo_id, func_id=func_id, func_name=func_name))
            
            if class_name:
                class_id = f"{file_path}::{class_name}"
                query_parent_class = """
                MATCH (fun:Function {id: $func_id, repo_id: $repo_id})
                MATCH (cls:Class {id: $class_id, repo_id: $repo_id})
                MERGE (cls)-[:DEFINES]->(fun)
                """
                session.execute_write(lambda tx: tx.run(
                    query_parent_class, repo_id=repo_id, func_id=func_id, class_id=class_id
                ))
            else:
                query_parent_file = """
                MATCH (fun:Function {id: $func_id, repo_id: $repo_id})
                MATCH (fil:File {id: $file_path, repo_id: $repo_id})
                MERGE (fil)-[:DEFINES]->(fun)
                """
                session.execute_write(lambda tx: tx.run(
                    query_parent_file, repo_id=repo_id, func_id=func_id, file_path=file_path
                ))

    def create_call_relationship(self, repo_id: str, from_id: str, to_id: str):
        """Creates a CALLS relationship between two entities (e.g. Function calling another Function)."""
        if not self._driver:
            return
        query = """
        MATCH (from_node) WHERE from_node.id = $from_id AND from_node.repo_id = $repo_id
        MATCH (to_node) WHERE to_node.id = $to_id AND to_node.repo_id = $repo_id
        MERGE (from_node)-[:CALLS]->(to_node)
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(
                query, repo_id=repo_id, from_id=from_id, to_id=to_id
            ))
            
    def get_repository_graph(self, repo_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """Fetches all nodes and relationships for a repository, including complexity/coupling metrics."""
        if not self._driver:
            return {"nodes": [], "edges": []}
            
        query_nodes = """
        MATCH (n)
        WHERE n.repo_id = $repo_id OR n.id = $repo_id
        OPTIONAL MATCH (n)-[r]-()
        WITH n, count(r) as degree, labels(n) as labels, properties(n) as props
        RETURN labels, props, degree
        """
        query_edges = """
        MATCH (n)-[r]->(m)
        WHERE n.repo_id = $repo_id AND m.repo_id = $repo_id
        RETURN n.id as source, m.id as target, type(r) as type
        """
        
        nodes_list = []
        edges_list = []
        
        with self._driver.session() as session:
            nodes_res = session.run(query_nodes, repo_id=repo_id)
            for record in nodes_res:
                props = record["props"]
                labels = record["labels"]
                node_type = labels[0].lower() if labels else "file"
                degree = record["degree"]
                
                # Complexity heuristic: based on type and importance, modified by coupling
                complexity = props.get("complexity", (degree * 0.5) + (5 if node_type == 'class' else 2))
                
                nodes_list.append({
                    "id": props.get("id"),
                    "name": props.get("name") or props.get("id").split("/")[-1],
                    "friendly_name": props.get("friendly_name") or props.get("name"),
                    "type": node_type,
                    "summary": props.get("summary"),
                    "importance": props.get("importance", 5),
                    "coupling": degree,
                    "complexity": complexity,
                    "x": props.get("x"),
                    "y": props.get("y")
                })
                
            edges_res = session.run(query_edges, repo_id=repo_id)
            for record in edges_res:
                source = record["source"]
                target = record["target"]
                edge_type = record["type"]
                edges_list.append({
                    "id": f"{source}-{target}-{edge_type}",
                    "source": source,
                    "target": target,
                    "type": edge_type
                })
                
        return {"nodes": nodes_list, "edges": edges_list}

    def delete_file_nodes(self, repo_id: str, file_path: str):
        """Deletes a file node, classes/functions defined in it, and all their relationships."""
        if not self._driver:
            return
        query = """
        MATCH (f:File {id: $path, repo_id: $repo_id})
        OPTIONAL MATCH (f)-[:DEFINES*1..2]->(subNode)
        DETACH DELETE f, subNode
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(query, repo_id=repo_id, path=file_path))

    def delete_folder_node(self, repo_id: str, folder_path: str):
        """Deletes a folder node and detaches all relationships."""
        if not self._driver:
            return
        query = """
        MATCH (fd:Folder {id: $path, repo_id: $repo_id})
        DETACH DELETE fd
        """
        with self._driver.session() as session:
            session.execute_write(lambda tx: tx.run(query, repo_id=repo_id, path=folder_path))

    def get_impact_radius(self, repo_id: str, node_id: str) -> List[Dict[str, Any]]:
        """Resolves the 'blast radius' (downstream dependents) of a specific node."""
        if not self._driver:
            return []
            
        # Recursive query looking for nodes that depend on the target
        # Following relationships in REVERSE (who calls me, who imports me)
        query = """
        MATCH (target {id: $node_id, repo_id: $repo_id})
        MATCH (dependent)-[:CALLS|IMPORTS|DEPENDS_ON|EXTENDS|ROUTES_TO*1..5]->(target)
        RETURN DISTINCT dependent
        """
        
        with self._driver.session() as session:
            result = session.run(query, repo_id=repo_id, node_id=node_id)
            dependents = []
            for record in result:
                node = record["dependent"]
                dependents.append({
                    "id": node["id"],
                    "name": node.get("name", "unnamed"),
                    "type": list(node.labels)[0].lower() if node.labels else "unknown",
                })
            return dependents

    def get_execution_trace(self, repo_id: str, start_node_id: str) -> List[Dict[str, Any]]:
        """Resolves a chronological execution path starting from a specific node."""
        if not self._driver:
            return []
            
        # Recursive query following [:ROUTES_TO], [:CALLS], and [:USES]
        query = """
        MATCH (start {id: $start_node_id, repo_id: $repo_id})
        MATCH path = (start)-[:ROUTES_TO|CALLS|USES*1..10]->(end)
        WITH path, nodes(path) as nodes, relationships(path) as rels
        ORDER BY length(path) DESC
        LIMIT 1
        RETURN nodes, rels
        """
        
        with self._driver.session() as session:
            result = session.run(query, repo_id=repo_id, start_node_id=start_node_id)
            record = result.single()
            if not record:
                return []
                
            trace = []
            for node in record["nodes"]:
                trace.append({
                    "id": node["id"],
                    "name": node.get("name", "unnamed"),
                    "type": list(node.labels)[0].lower() if node.labels else "unknown",
                })
            return trace

    def get_node_context(self, repo_id: str, node_id: str) -> List[Dict[str, str]]:
        """Gets immediate neighbors to provide context for AI explanation."""
        if not self._driver:
            return []
        query = """
        MATCH (n {id: $node_id, repo_id: $repo_id})-[r]-(m {repo_id: $repo_id})
        RETURN type(r) as rel_type, m.name as neighbor_name, labels(m)[0] as neighbor_type
        LIMIT 10
        """
        edges = []
        with self._driver.session() as session:
            result = session.run(query, repo_id=repo_id, node_id=node_id)
            for record in result:
                edges.append({
                    "relationship": record["rel_type"],
                    "neighbor": record["neighbor_name"] or "Unknown",
                    "type": record["neighbor_type"] or "Unknown"
                })
        return edges

    def get_domain_flow(self, repo_id: str, domain_id: str) -> List[Dict[str, Any]]:
        """Resolves the primary execution flow within a specific semantic domain."""
        if not self._driver:
            return []
        
        query = """
        MATCH (d:SemanticDomain {id: $domain_id, repo_id: $repo_id})-[:CONTAINS]->(n)
        WITH collect(n) as domain_nodes
        MATCH path = (start)-[:ROUTES_TO|CALLS|USES*1..10]->(end)
        WHERE start IN domain_nodes AND end IN domain_nodes
        WITH path, nodes(path) as nodes
        ORDER BY length(path) DESC
        LIMIT 1
        RETURN nodes
        """
        
        with self._driver.session() as session:
            result = session.run(query, repo_id=repo_id, domain_id=domain_id)
            record = result.single()
            if not record:
                return []
                
            trace = []
            for node in record["nodes"]:
                trace.append({
                    "id": node["id"],
                    "name": node.get("name", "unnamed"),
                    "type": list(node.labels)[0].lower() if node.labels else "unknown",
                })
            return trace
