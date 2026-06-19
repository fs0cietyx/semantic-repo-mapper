import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup relative import path
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup in-memory SQLite engine
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_api.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Monkeypatch database engine inside database module BEFORE importing main to bypass live Postgres requirement
import backend.api.database
backend.api.database.engine = engine

from backend.api.main import app, get_db
from backend.api.database import Base
from backend.api import models

class TestAPIRoutes(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Create database tables in SQLite
        Base.metadata.create_all(bind=engine)
        
    @classmethod
    def tearDownClass(cls):
        # Drop database tables
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./test_api.db"):
            os.remove("./test_api.db")

    def setUp(self):
        # Reset tables before each test
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        # Override dependency injection session
        def override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()
                
        app.dependency_overrides[get_db] = override_get_db
        
        # Initialize test client (triggers FastAPI startup events)
        self.client = TestClient(app)
        
        # Overwrite main global connectors with mocks after startup finishes
        import backend.api.main
        self.mock_neo4j = MagicMock()
        self.mock_qdrant = MagicMock()
        self.mock_embedder = MagicMock()
        self.mock_summarizer = MagicMock()
        
        backend.api.main.neo4j_conn = self.mock_neo4j
        backend.api.main.qdrant_conn = self.mock_qdrant
        backend.api.main.embedder = self.mock_embedder
        backend.api.main.summarizer = self.mock_summarizer

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_import_repository(self):
        # Mock database reset operations
        self.mock_neo4j.clear_repository_graph = MagicMock()
        self.mock_neo4j.create_repository_node = MagicMock()
        
        with patch("backend.workers.tasks.index_repository_task") as mock_task:
            response = self.client.post(
                "/api/repository/import",
                json={"repo_url": "https://github.com/google-deepmind/antigravity"}
            )
            self.assertEqual(response.status_code, 202)
            data = response.json()
            self.assertEqual(data["repo_id"], "google-deepmind_antigravity")
            self.assertEqual(data["status"], "queued")
            
            # Note: In the current implementation, this is called inside a thread.
            # We check if the thread was started by verifying the mock call.
            # We might need a small sleep or a join, but since it's mocked, it should be fast.
            import time
            time.sleep(0.1) 
            mock_task.assert_called_once_with("google-deepmind_antigravity", "https://github.com/google-deepmind/antigravity")

    def test_get_repository_status(self):
        # Pre-populate relational model metadata in SQLite
        db = TestingSessionLocal()
        repo = models.RepositoryMetadata(
            id="test_repo",
            repo_url="https://github.com/test/repo",
            repo_name="repo",
            status="completed",
            progress=100.0,
            project_types=["Python"]
        )
        db.add(repo)
        db.commit()
        db.close()
        
        response = self.client.get("/api/repository/test_repo/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["repo_id"], "test_repo")
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["progress"], 100.0)

    def test_get_repository_graph(self):
        # Pre-populate repository in SQLite
        db = TestingSessionLocal()
        repo = models.RepositoryMetadata(id="test_repo", repo_url="https://github.com/test/repo", repo_name="repo", status="completed")
        db.add(repo)
        db.commit()
        db.close()

        # Mock Neo4j driver response
        self.mock_neo4j.get_repository_graph = MagicMock(return_value={
            "nodes": [{"id": "file.py", "name": "file.py", "type": "file"}],
            "edges": []
        })

        response = self.client.get("/api/repository/test_repo/graph")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["repository_id"], "test_repo")
        self.assertEqual(len(data["nodes"]), 1)
        self.assertEqual(data["nodes"][0]["id"], "file.py")

    def test_get_repository_tours(self):
        # Pre-populate repository in SQLite
        db = TestingSessionLocal()
        repo = models.RepositoryMetadata(id="test_repo", repo_url="https://github.com/test/repo", repo_name="repo", status="completed")
        db.add(repo)
        db.commit()
        db.close()

        response = self.client.get("/api/repository/test_repo/tours")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue("tours" in data)
        self.assertEqual(len(data["tours"]), 1)
        self.assertEqual(data["tours"][0]["id"], "system_overview")
        self.assertEqual(data["tours"][0]["steps"][0]["title"], "Entry Point")

    def test_get_repository_trace(self):
        # Pre-populate repository
        db = TestingSessionLocal()
        repo = models.RepositoryMetadata(id="test_repo", repo_url="https://github.com/test/repo", repo_name="repo", status="completed")
        db.add(repo)
        db.commit()
        db.close()

        response = self.client.get("/api/repository/test_repo/trace/start_node")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue("trace" in data)
        # Verify fallback data (since Neo4j is likely mocked/offline in test env)
        self.assertEqual(data["trace"][0]["id"], "start_node")

    def test_search_repository_hybrid(self):
        # Pre-populate database
        db = TestingSessionLocal()
        repo = models.RepositoryMetadata(id="test_repo", repo_url="https://github.com/test/repo", repo_name="repo", status="completed")
        db.add(repo)
        
        # Add a cached keyword summary
        summary = models.CachedSummary(
            repo_id="test_repo",
            entity_path="main.py",
            entity_type="file",
            summary="This is the main setup code containing database credentials."
        )
        db.add(summary)
        db.commit()
        db.close()

        # Mock embedder and Qdrant semantic search
        self.mock_embedder.generate_embedding = MagicMock(return_value=[0.1] * 1536)
        self.mock_qdrant.search_symbols = MagicMock(return_value=[
            {"id": "db.py", "name": "db.py", "type": "file", "summary": "DB connector functions.", "score": 0.85}
        ])

        response = self.client.get("/api/repository/test_repo/search?q=database")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get("results", [])
        
        # Should merge Postgres matches and Qdrant semantic hits
        self.assertEqual(len(results), 2)
        match_types = [r["match_type"] for r in results]
        self.assertTrue("keyword" in match_types)
        self.assertTrue("semantic" in match_types)

if __name__ == "__main__":
    unittest.main()
