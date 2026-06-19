from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.api.config import settings

# In production settings, postgres_url resolves to the docker postgres container.
# In local development tests, it points to local postgres port.
# Attempt to connect to PostgreSQL, falling back to a local SQLite file if offline
try:
    engine = create_engine(
        settings.postgres_url,
        pool_pre_ping=True
    )
    # Attempt a quick connection to verify status
    with engine.connect() as conn:
        pass
    print("Database Connection: Connected to PostgreSQL successfully.")
except Exception as db_err:
    print(f"Database Connection: PostgreSQL connection failed ({db_err}). Falling back to local SQLite.")
    engine = create_engine(
        "sqlite:///./local_visualizer.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    """Dependency for obtaining a database session in routers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
