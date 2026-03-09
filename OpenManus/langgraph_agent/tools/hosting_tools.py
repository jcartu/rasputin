from typing import Optional, List
from langchain_core.tools import tool
import os
import json
import shutil
import uuid
from pathlib import Path
from datetime import datetime


HOSTING_BASE_DIR = "/var/www/manus-projects"
HOSTING_BASE_URL = "https://manus.rasputin.to/projects"
PROJECTS_DB_FILE = "/var/www/manus-projects/.projects.json"


class HostingTools:
    def __init__(self, workspace_path: str = "/workspace"):
        self.workspace_path = workspace_path
        self.hosting_dir = HOSTING_BASE_DIR
        self.base_url = HOSTING_BASE_URL
        os.makedirs(self.hosting_dir, exist_ok=True)

    def _load_projects_db(self) -> dict:
        if os.path.exists(PROJECTS_DB_FILE):
            with open(PROJECTS_DB_FILE, "r") as f:
                return json.load(f)
        return {"projects": {}}

    def _save_projects_db(self, db: dict):
        with open(PROJECTS_DB_FILE, "w") as f:
            json.dump(db, f, indent=2)

    def _safe_path(self, path: str) -> str:
        full_path = os.path.normpath(
            os.path.join(self.workspace_path, path.lstrip("/"))
        )
        if not full_path.startswith(self.workspace_path):
            raise ValueError(f"Path {path} is outside workspace")
        return full_path

    def _generate_subdomain(self, project_name: str) -> str:
        base = project_name.lower().replace(" ", "-").replace("_", "-")
        base = "".join(c for c in base if c.isalnum() or c == "-")
        base = base[:30]

        db = self._load_projects_db()
        if base not in db["projects"]:
            return base

        suffix = str(uuid.uuid4())[:6]
        return f"{base}-{suffix}"

    async def publish_project(
        self, project_dir: str, custom_subdomain: Optional[str] = None
    ) -> dict:
        try:
            source_path = self._safe_path(project_dir)

            if not os.path.exists(source_path):
                return {
                    "success": False,
                    "error": f"Project directory '{project_dir}' not found",
                }

            manifest_path = os.path.join(source_path, "manifest.json")
            if os.path.exists(manifest_path):
                with open(manifest_path, "r") as f:
                    manifest = json.load(f)
                project_name = manifest.get("name", project_dir)
            else:
                project_name = project_dir

            subdomain = custom_subdomain or self._generate_subdomain(project_name)
            subdomain = subdomain.lower().replace(" ", "-")

            dest_path = os.path.join(self.hosting_dir, subdomain)

            if os.path.exists(dest_path):
                shutil.rmtree(dest_path)

            shutil.copytree(source_path, dest_path)

            db = self._load_projects_db()
            url = f"{self.base_url}/{subdomain}/"

            db["projects"][subdomain] = {
                "name": project_name,
                "source": project_dir,
                "published_at": datetime.now().isoformat(),
                "url": url,
            }
            self._save_projects_db(db)

            return {
                "success": True,
                "subdomain": subdomain,
                "url": url,
                "message": f"Project published successfully! Visit: {url}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_published(self) -> dict:
        try:
            db = self._load_projects_db()
            projects = []

            for subdomain, info in db["projects"].items():
                project_path = os.path.join(self.hosting_dir, subdomain)
                exists = os.path.exists(project_path)

                projects.append(
                    {
                        "subdomain": subdomain,
                        "name": info.get("name", subdomain),
                        "url": info.get("url", f"{self.base_url}/{subdomain}/"),
                        "published_at": info.get("published_at", "Unknown"),
                        "status": "online" if exists else "missing",
                    }
                )

            return {"success": True, "projects": projects, "total": len(projects)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def unpublish_project(self, subdomain: str) -> dict:
        try:
            project_path = os.path.join(self.hosting_dir, subdomain)

            if os.path.exists(project_path):
                shutil.rmtree(project_path)

            db = self._load_projects_db()
            if subdomain in db["projects"]:
                del db["projects"][subdomain]
                self._save_projects_db(db)

            return {
                "success": True,
                "message": f"Project '{subdomain}' has been unpublished",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_project_url(self, subdomain: str) -> dict:
        db = self._load_projects_db()

        if subdomain in db["projects"]:
            info = db["projects"][subdomain]
            return {
                "success": True,
                "url": info.get("url", f"{self.base_url}/{subdomain}/"),
                "name": info.get("name", subdomain),
            }

        return {"success": False, "error": f"Project '{subdomain}' not found"}


def create_hosting_tools(hosting: HostingTools) -> List:
    @tool
    async def publish_project(project_dir: str, custom_subdomain: str = "") -> str:
        """Publish a project to manus.rasputin.to/projects/{name}/ for public access.

        project_dir: The directory in the workspace containing the project to publish
        custom_subdomain: Optional custom name for the URL path (auto-generated if not provided)

        Returns the public URL where the project can be accessed.
        """
        result = await hosting.publish_project(
            project_dir, custom_subdomain if custom_subdomain else None
        )
        return str(result)

    @tool
    async def list_published_projects() -> str:
        """List all projects that have been published to rasputin.to subdomains."""
        result = await hosting.list_published()
        return str(result)

    @tool
    async def unpublish_project(subdomain: str) -> str:
        """Remove a published project from its subdomain.

        subdomain: The subdomain of the project to unpublish (e.g., 'my-project' for my-project.rasputin.to)
        """
        result = await hosting.unpublish_project(subdomain)
        return str(result)

    @tool
    async def get_project_url(subdomain: str) -> str:
        """Get the public URL for a published project.

        subdomain: The subdomain of the project
        """
        result = await hosting.get_project_url(subdomain)
        return str(result)

    return [
        publish_project,
        list_published_projects,
        unpublish_project,
        get_project_url,
    ]
