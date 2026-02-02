import { useState, useEffect, useCallback } from "react";

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  file_count?: number;
  session_count?: number;
}

interface ProjectsPanelProps {
  currentProjectId: string | null;
  onSelectProject: (project: Project | null) => void;
  onNewChat: (projectId: string | null) => void;
}

export function ProjectsPanel({
  currentProjectId,
  onSelectProject,
  onNewChat,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      void 0;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = useCallback(async () => {
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch(
        `/api/projects?name=${encodeURIComponent(newProjectName.trim())}`,
        { method: "POST" }
      );
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [project, ...prev]);
        setNewProjectName("");
        setIsCreating(false);
        onSelectProject(project);
      }
    } catch {
      void 0;
    }
  }, [newProjectName, onSelectProject]);

  const handleDelete = useCallback(
    async (projectId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this project and all its data?")) return;

      try {
        await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentProjectId === projectId) {
          onSelectProject(null);
        }
      } catch {
        void 0;
      }
    },
    [currentProjectId, onSelectProject]
  );

  const handleTogglePin = useCallback(
    async (project: Project, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const res = await fetch(
          `/api/projects/${project.id}?pinned=${!project.pinned}`,
          { method: "PUT" }
        );
        if (res.ok) {
          setProjects(prev =>
            prev.map(p =>
              p.id === project.id ? { ...p, pinned: !p.pinned } : p
            )
          );
        }
      } catch {
        void 0;
      }
    },
    []
  );

  const handleSaveInstructions = useCallback(async () => {
    if (!editingProject) return;

    try {
      const res = await fetch(
        `/api/projects/${editingProject.id}?instructions=${encodeURIComponent(editingProject.instructions)}`,
        { method: "PUT" }
      );
      if (res.ok) {
        setProjects(prev =>
          prev.map(p =>
            p.id === editingProject.id
              ? { ...p, instructions: editingProject.instructions }
              : p
          )
        );
        setEditingProject(null);
      }
    } catch {
      void 0;
    }
  }, [editingProject]);

  const selectedProject = projects.find(p => p.id === currentProjectId);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
      <div className="px-3 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <span className="text-sm font-medium text-zinc-300">Projects</span>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
          title="New project"
        >
          ➕
        </button>
      </div>

      {isCreating && (
        <div className="p-3 border-b border-zinc-800 bg-zinc-800/50">
          <input
            type="text"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            placeholder="Project name..."
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewProjectName("");
              }
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCreate}
              disabled={!newProjectName.trim()}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewProjectName("");
              }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectProject(null)}
          className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left ${
            !currentProjectId ? "bg-zinc-800 border-l-2 border-blue-500" : ""
          }`}
        >
          <span className="text-sm">💬</span>
          <span className="text-sm text-zinc-300">No Project</span>
        </button>

        {isLoading ? (
          <div className="px-3 py-4 text-center text-zinc-600 text-sm">
            Loading...
          </div>
        ) : (
          projects.map(project => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left group ${
                currentProjectId === project.id
                  ? "bg-zinc-800 border-l-2 border-blue-500"
                  : ""
              }`}
            >
              <span className="text-sm">{project.pinned ? "📌" : "📁"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-300 truncate">
                  {project.name}
                </div>
                {project.description && (
                  <div className="text-xs text-zinc-600 truncate">
                    {project.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => handleTogglePin(project, e)}
                  className="p-1 text-zinc-500 hover:text-yellow-400 transition-colors"
                  title={project.pinned ? "Unpin" : "Pin"}
                >
                  📌
                </button>
                <button
                  onClick={e => handleDelete(project.id, e)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedProject && (
        <div className="border-t border-zinc-800 p-3 bg-zinc-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Instructions
            </span>
            {editingProject?.id === selectedProject.id ? (
              <div className="flex gap-1">
                <button
                  onClick={handleSaveInstructions}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingProject(null)}
                  className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingProject(selectedProject)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editingProject?.id === selectedProject.id ? (
            <textarea
              value={editingProject.instructions}
              onChange={e =>
                setEditingProject({
                  ...editingProject,
                  instructions: e.target.value,
                })
              }
              placeholder="Add custom instructions for this project..."
              className="w-full h-24 px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-xs text-zinc-300 placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <div className="text-xs text-zinc-500 line-clamp-3">
              {selectedProject.instructions || "No instructions set"}
            </div>
          )}

          <button
            onClick={() => onNewChat(selectedProject.id)}
            className="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>💬</span>
            <span>New Chat in Project</span>
          </button>
        </div>
      )}
    </div>
  );
}
