from sqlalchemy import Column, String, Float, DateTime, Integer, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from backend.api.database import Base

class RepositoryMetadata(Base):
    """Stores high-level metadata, ingestion state, and languages of indexed repos."""
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, index=True) # Unique identifier
    repo_url = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="queued") # queued, cloning, parsing, completed, failed
    progress = Column(Float, default=0.0)
    project_types = Column(JSON, default=[]) # e.g. ["Python", "TypeScript"]
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    last_indexed_commit = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UserSettings(Base):
    """Stores secure user-specific configurations, such as GitHub PATs and AI keys."""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    github_token = Column(String, nullable=True) 
    gemini_api_key = Column(String, nullable=True) # Secure persistent AI credential
    preferred_theme = Column(String, default="win95")
    ai_summaries_enabled = Column(JSON, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TaskLog(Base):
    """Tracks background ingestion, indexing, and LLM processing jobs."""
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    task_type = Column(String, nullable=False) # clone, parse, summarize, embed
    status = Column(String, nullable=False) # running, completed, failed
    log_output = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ASTSymbol(Base):
    """Unified AST node caching for multi-language parsing outputs."""
    __tablename__ = "ast_symbols"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    file_path = Column(String, nullable=False, index=True)
    symbol_name = Column(String, nullable=False)
    symbol_type = Column(String, nullable=False) # class, function, method, import, api_endpoint, etc.
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    parent_symbol = Column(String, nullable=True) # e.g. class name if it's a method
    attributes = Column(JSON, default={}) # extra data like arguments, modifiers, visibility
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CachedSummary(Base):
    """Stores LLM-generated summaries for files and modules, acting as a fallback to Redis."""
    __tablename__ = "cached_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    entity_path = Column(String, nullable=False, index=True) # File path or folder path
    entity_type = Column(String, nullable=False) # file, folder, function, class
    summary = Column(Text, nullable=False)
    tags = Column(JSON, default=[]) # e.g. ["auth", "stripe"]
    vector = Column(JSON, nullable=True) # Cached embedding vector (List[float])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
