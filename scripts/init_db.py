import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.api.database import engine, Base
from backend.api import models

def init_db():
    print("Initializing databases...")
    Base.metadata.create_all(bind=engine)
    print("PostgreSQL/SQLite tables created.")
    
    # Neo4j initialization is handled in Neo4jConnector.__init__
    from backend.graph.neo4j_driver import Neo4jConnector
    neo4j = Neo4jConnector()
    if neo4j._driver:
        print("Neo4j constraints and indexes verified.")
        neo4j.close()
    else:
        print("Warning: Neo4j connection failed. Skipping graph initialization.")

if __name__ == "__main__":
    init_db()
