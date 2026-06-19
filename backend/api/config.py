import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API configuration
    API_ENV: str = "development"
    
    # Postgres configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "codebase_visualizer"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # Neo4j configuration
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Redis configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Qdrant configuration
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

    # LLM configurations (Ollama / OpenAI endpoint)
    LLM_API_KEY: str = "local"
    LLM_BASE_URL: str = "http://localhost:11434/v1" # Local Ollama default
    LLM_MODEL: str = "deepseek-coder:6.7b"
    EMBEDDING_MODEL: str = "nomic-embed-text"

    # Gemini configuration (dynamic override)
    GEMINI_API_KEY: Optional[str] = None

    def model_post_init(self, __context):
        if self.GEMINI_API_KEY:
            self.LLM_API_KEY = self.GEMINI_API_KEY
            self.LLM_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
            if self.LLM_MODEL == "deepseek-coder:6.7b":
                self.LLM_MODEL = "gemini-1.5-flash"
            if self.EMBEDDING_MODEL == "nomic-embed-text":
                self.EMBEDDING_MODEL = "text-embedding-004"

    @property
    def postgres_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
