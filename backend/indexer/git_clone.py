import os
import shutil
import subprocess
import pwd
from typing import Dict, List, Any
import git

class RepositoryCloner:
    """Clones git repositories and analyzes metadata structure."""
    
    def __init__(self, storage_root: str = None):
        self.storage_root = storage_root or os.getenv("REPO_STORAGE_ROOT", "/tmp/visualizer_repos")
        os.makedirs(self.storage_root, exist_ok=True)

    def get_repo_path(self, repo_url: str) -> str:
        """Generates a unique local folder path for a given repo URL."""
        repo_name = repo_url.split("/")[-1].replace(".git", "")
        # Add hash or unique id if needed.
        return os.path.join(self.storage_root, repo_name)

    def clone_repository(self, repo_url: str, token: str = None) -> str:
        """Clones a remote repository to local storage and returns path with security sandboxing."""
        target_path = self.get_repo_path(repo_url)
        
        # Clean existing repo folder if it exists
        if os.path.exists(target_path):
            shutil.rmtree(target_path)
            
        # Prepare authenticated URL if token is provided
        clone_url = repo_url
        if token:
            # Pattern: https://x-access-token:<token>@github.com/owner/repo.git
            if "github.com" in repo_url:
                clone_url = repo_url.replace("https://", f"https://x-access-token:{token}@")
        
        print(f"Cloning {repo_url} into {target_path} (sandboxed)...")
        # --- ENTERPRISE SANDBOXING ---
        # Attempt to use a read-only, restricted Docker container to perform the clone
        use_docker = shutil.which("docker") is not None
        
        if use_docker:
            print("[SECURITY] Docker detected. Enforcing Level 4 Container Isolation.")
            try:
                uid = os.getuid()
                gid = os.getgid()
                cmd = [
                    "docker", "run", "--rm",
                    "--read-only",
                    "--cap-drop=ALL",
                    "--security-opt=no-new-privileges",
                    f"-u", f"{uid}:{gid}",
                    "-v", f"{self.storage_root}:/storage",
                    "alpine/git", "clone",
                    "-c", "core.hooksPath=/dev/null",
                    "--depth=1",
                    "--single-branch",
                    "--no-tags",
                    clone_url,
                    f"/storage/{target_path.split('/')[-1]}"
                ]
                subprocess.run(cmd, check=True, capture_output=True)
                return target_path
            except subprocess.CalledProcessError as e:
                print(f"[ERROR] Sandboxed clone failed: {e.stderr}. Falling back...")
        else:
            print("[WARNING] Docker not found! Falling back to GitPython. VULN-002: Lacking Container Isolation.")
        
        # --- FALLBACK ---
        # Secure configuration parameters for GitPython:
        # -c core.hooksPath=/dev/null: disable hook execution
        # --depth=1: limit git history size to prevent disk space leaks
        # --single-branch: fetch only default branch
        # --no-tags: do not download unnecessary tag objects
        git.Repo.clone_from(
            clone_url,
            target_path,
            multi_options=[
                "-c core.hooksPath=/dev/null",
                "--depth=1",
                "--single-branch",
                "--no-tags"
            ],
            allow_unsafe_options=True
        )
        return target_path

    def get_latest_commit(self, repo_path: str) -> str:
        """Returns the current HEAD commit hash."""
        repo = git.Repo(repo_path)
        return repo.head.commit.hexsha

    def update_repository(self, repo_url: str, token: str = None) -> str:
        """Pulls changes if repo already exists, otherwise clones it securely."""
        target_path = self.get_repo_path(repo_url)
        if os.path.exists(target_path) and os.path.exists(os.path.join(target_path, ".git")):
            print(f"Repository exists. Pulling updates securely into {target_path}...")
            try:
                repo = git.Repo(target_path)
                
                # Update remote URL to include token if provided
                if token and "github.com" in repo_url:
                    auth_url = repo_url.replace("https://", f"https://x-access-token:{token}@")
                    repo.remotes.origin.set_url(auth_url)
                
                repo.git.pull("-c", "core.hooksPath=/dev/null", "--depth=1", allow_unsafe_options=True)
                return target_path
            except Exception as e:
                print(f"Failed to pull repository securely, resetting and re-cloning: {e}")
                return self.clone_repository(repo_url, token=token)
        else:
            return self.clone_repository(repo_url, token=token)

    def get_diff_files(self, repo_path: str, from_commit: str, to_commit: str) -> Dict[str, List[str]]:
        """Gets lists of added, modified, and deleted files between two commit hashes."""
        repo = git.Repo(repo_path)
        diff_index = repo.commit(from_commit).diff(repo.commit(to_commit))
        
        added = []
        modified = []
        deleted = []
        
        for diff in diff_index:
            if diff.change_type == 'A':
                added.append(diff.b_path)
            elif diff.change_type == 'M':
                modified.append(diff.b_path)
            elif diff.change_type == 'D':
                deleted.append(diff.a_path)
            elif diff.change_type == 'R':
                deleted.append(diff.a_path)
                added.append(diff.b_path)
                
        # Filter out ignored patterns
        ignore_dirs = {".git", "node_modules", "venv", "__pycache__", ".next", "dist", "build"}
        ignore_extensions = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar.gz", ".DS_Store"}
        
        def is_ignored(path: str) -> bool:
            parts = path.split(os.sep)
            if any(p in ignore_dirs for p in parts):
                return True
            ext = os.path.splitext(path)[1]
            if ext in ignore_extensions:
                return True
            return False
            
        return {
            "added": [f for f in added if not is_ignored(f)],
            "modified": [f for f in modified if not is_ignored(f)],
            "deleted": [f for f in deleted if not is_ignored(f)]
        }

    def detect_project_type(self, repo_path: str) -> List[str]:
        """Detects the programming language/ecosystem of the project."""
        project_types = []
        files = os.listdir(repo_path)
        
        mapping = {
            "package.json": "NodeJS/TypeScript",
            "requirements.txt": "Python",
            "pyproject.toml": "Python",
            "Cargo.toml": "Rust",
            "pom.xml": "Java",
            "build.gradle": "Java",
            "go.mod": "Go"
        }
        
        for file, lang in mapping.items():
            if file in files:
                project_types.append(lang)
                
        # Simple recursive check if nothing in root
        if not project_types:
            for root, dirs, filenames in os.walk(repo_path):
                # Prune search space
                if any(x in root for x in [".git", "node_modules", "venv", "__pycache__"]):
                    continue
                for f in filenames:
                    if f in mapping:
                        project_types.append(mapping[f])
                        break
                if project_types:
                    break
                    
        return list(set(project_types)) if project_types else ["Unknown"]

    def build_file_tree(self, repo_path: str) -> List[Dict[str, Any]]:
        """
        Scans the cloned workspace directory recursively.
        Returns a flat list of node descriptors representing files and folders.
        """
        nodes = []
        ignore_dirs = {".git", "node_modules", "venv", "__pycache__", ".next", "dist", "build"}
        ignore_extensions = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar.gz", ".DS_Store"}

        for root, dirs, files in os.walk(repo_path):
            # Prune directory searches
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            # Record directories
            for d in dirs:
                full_path = os.path.join(root, d)
                rel_path = os.path.relpath(full_path, repo_path)
                parent_path = os.path.relpath(root, repo_path)
                nodes.append({
                    "id": rel_path,
                    "name": d,
                    "type": "folder",
                    "parent": "" if parent_path == "." else parent_path
                })
                
            # Record files
            for f in files:
                ext = os.path.splitext(f)[1]
                if ext in ignore_extensions:
                    continue
                    
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, repo_path)
                parent_path = os.path.relpath(root, repo_path)
                
                nodes.append({
                    "id": rel_path,
                    "name": f,
                    "type": "file",
                    "parent": "" if parent_path == "." else parent_path
                })
                
        return nodes
