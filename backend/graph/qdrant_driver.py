import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from backend.api.config import settings

class QdrantConnector:
    """Manages connection and indexing for Qdrant Vector database."""
    
    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self.collection_name = "codebase_symbols"
        try:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                timeout=1.0
            )
        except Exception as e:
            print(f"Failed to initialize Qdrant client connection: {e}")

    def init_collection(self, vector_size: int):
        """Initializes the codebase collection if it doesn't already exist."""
        if not self.client:
            return
        
        try:
            # Check if collection exists
            collections_resp = self.client.get_collections()
            exists = any(col.name == self.collection_name for col in collections_resp.collections)
            
            if not exists:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=vector_size,
                        distance=qmodels.Distance.COSINE
                    )
                )
                print(f"Created Qdrant collection: {self.collection_name} (dim: {vector_size})")
        except Exception as e:
            print(f"Error checking/creating Qdrant collection: {e}")

    def upsert_symbol(
        self,
        repo_id: str,
        entity_path: str,
        name: str,
        entity_type: str,
        summary: str,
        vector: List[float],
        text_hash: Optional[str] = None
    ):
        """Upserts a symbol embedding vector and metadata payload to Qdrant."""
        if not self.client:
            return

        # Initialize collection using vector length
        self.init_collection(vector_size=len(vector))

        try:
            # Deterministic UUID based on repo_id and entity_path to prevent duplicates
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{repo_id}:{entity_path}"))
            
            payload = {
                "repo_id": repo_id,
                "path": entity_path,
                "name": name,
                "type": entity_type,
                "summary": summary
            }
            if text_hash:
                payload["text_hash"] = text_hash
                
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    qmodels.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                ]
            )
        except Exception as e:
            print(f"Failed to upsert point to Qdrant: {e}")

    def get_vector_by_hash(self, repo_id: str, text_hash: str) -> Optional[List[float]]:
        """Queries Qdrant to find a vector matching repo_id and text_hash to reuse as cached embedding."""
        if not self.client or not text_hash:
            return None
        try:
            results, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="repo_id",
                            match=qmodels.MatchValue(value=repo_id)
                        ),
                        qmodels.FieldCondition(
                            key="text_hash",
                            match=qmodels.MatchValue(value=text_hash)
                        )
                    ]
                ),
                limit=1,
                with_vectors=True
            )
            if results and len(results) > 0:
                # Return the vector list from matching point
                return results[0].vector
        except Exception as e:
            print(f"Failed to query Qdrant by hash: {e}")
        return None

    def delete_repository_vectors(self, repo_id: str):
        """Removes all indexed vectors associated with a specific repo_id."""
        if not self.client:
            return
        
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qmodels.FilterSelector(
                    filter=qmodels.Filter(
                        must=[
                            qmodels.FieldCondition(
                                key="repo_id",
                                match=qmodels.MatchValue(value=repo_id)
                            )
                        ]
                    )
                )
            )
        except Exception as e:
            print(f"Failed to clean up Qdrant vectors for repo {repo_id}: {e}")

    def delete_symbols_by_paths(self, repo_id: str, paths: List[str]):
        """Deletes Qdrant points by list of entity paths in a repository."""
        if not self.client or not paths:
            return
        
        try:
            # Generate UUIDs for all paths
            point_ids = []
            for path in paths:
                point_ids.append(str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{repo_id}:{path}")))
                
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qmodels.PointIdsList(
                    points=point_ids
                )
            )
            print(f"Deleted {len(point_ids)} points from Qdrant associated with updated/removed files.")
        except Exception as e:
            print(f"Failed to delete Qdrant points by paths: {e}")

    def search_symbols(
        self,
        repo_id: str,
        query_vector: List[float],
        limit: int = 10,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Performs semantic similarity search on code vectors within a repository."""
        if not self.client:
            return []

        try:
            # Set up filter conditions
            must_conditions = [
                qmodels.FieldCondition(
                    key="repo_id",
                    match=qmodels.MatchValue(value=repo_id)
                )
            ]
            
            if entity_type:
                must_conditions.append(
                    qmodels.FieldCondition(
                        key="type",
                        match=qmodels.MatchValue(value=entity_type)
                    )
                )
                
            search_filter = qmodels.Filter(must=must_conditions)
            
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=search_filter,
                limit=limit
            )
            
            output = []
            for hit in results:
                payload = hit.payload or {}
                output.append({
                    "id": payload.get("path"),
                    "name": payload.get("name"),
                    "type": payload.get("type"),
                    "summary": payload.get("summary"),
                    "score": hit.score
                })
            return output
        except Exception as e:
            print(f"Qdrant vector search failed: {e}")
            return []
