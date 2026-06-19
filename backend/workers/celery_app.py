from celery import Celery
from backend.api.config import settings

celery_app = Celery(
    "visualizer_tasks",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    imports=["backend.workers.tasks"],
    
    # Task execution timeouts to prevent hung connections
    task_time_limit=900,         # 15 minutes hard timeout
    task_soft_time_limit=800,    # ~13 minutes soft timeout
    
    # Process memory limit sandboxing (restarts worker process to free leaked memory)
    worker_max_memory_per_child=1024000, # 1GB (in kilobytes)
    worker_max_tasks_per_child=20        # Recycles child process after 20 tasks
)
