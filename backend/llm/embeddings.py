import random
import hashlib
import warnings
from typing import List, Optional
from backend.api.config import settings

# Suppress Hugging Face warnings
warnings.filterwarnings("ignore")

class EmbeddingGenerator:
    """Generates text embeddings via local offline models or deterministic fallbacks."""
    
    def __init__(self):
        try:
            from sentence_transformers import SentenceTransformer
            # Initialize lightweight, offline model (downloads once to ~/.cache, then runs offline)
            print("Loading local offline embedding model (all-MiniLM-L6-v2)...")
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.is_offline = True
        except ImportError:
            print("Warning: sentence-transformers not installed. Falling back to deterministic hashes.")
            self.model = None
            self.is_offline = False

    def generate_embedding(self, text: str) -> List[float]:
        """Generates a list of floats representing the embedding vector of the input text."""
        try:
            if self.model:
                # Generate real offline semantic embedding
                vector = self.model.encode(text)
                return vector.tolist()
            else:
                return self._generate_deterministic_mock_vector(text, 384)
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            return self._generate_deterministic_mock_vector(text, 384)

    def _generate_deterministic_mock_vector(self, text: str, dim: int = 384) -> List[float]:
        """Generates a stable, reproducible vector of floats for a given text."""
        h = hashlib.sha256(text.encode("utf-8")).digest()
        seed = int.from_bytes(h, byteorder="big")
        
        rng = random.Random(seed)
        vec = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
        
        norm = sum(x**2 for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
            
        return vec
