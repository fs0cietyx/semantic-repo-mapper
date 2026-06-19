FROM python:3.11-slim

# Install git and essential system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root system user and group for sandbox isolation
RUN groupadd -g 1000 visualizer && \
    useradd -m -u 1000 -g visualizer -s /bin/bash visualizer

# Set working directory to /app (PYTHONPATH will include /app)
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source files
COPY . /app/backend/

# Ensure proper non-root ownership on app files
RUN chown -R visualizer:visualizer /app

# Create repository clone storage location and grant permissions
RUN mkdir -p /var/lib/visualizer/repos && \
    chown -R visualizer:visualizer /var/lib/visualizer/repos

# Configure environment variables
ENV REPO_STORAGE_ROOT=/var/lib/visualizer/repos
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run the container under the non-root user context
USER visualizer

# Expose API port
EXPOSE 8000

# Default command to launch FastAPI server (overridden for Celery worker containers)
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
