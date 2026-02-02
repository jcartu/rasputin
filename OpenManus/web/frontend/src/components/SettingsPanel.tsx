import { useState, useEffect, useCallback } from "react";

interface Model {
  id: string;
  name: string;
}

interface Settings {
  model: string;
  api_key_configured: boolean;
  api_key_preview?: string;
  available_models: Model[];
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSelectedModel(data.model);
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      if (selectedModel && selectedModel !== settings?.model) {
        params.set("model", selectedModel);
      }
      if (newApiKey.trim()) {
        params.set("api_key", newApiKey.trim());
      }

      if (params.toString()) {
        const res = await fetch(`/api/settings?${params}`, { method: "PUT" });
        if (res.ok) {
          setMessage({ type: "success", text: "Settings saved!" });
          setNewApiKey("");
          fetchSettings();
        } else {
          throw new Error("Failed to save");
        }
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-700/50 z-50 flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : settings ? (
            <>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-300">
                    AI Model
                  </span>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {settings.available_models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">
                    API Key
                  </span>
                  {settings.api_key_configured && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Configured
                    </span>
                  )}
                </div>

                {settings.api_key_preview && (
                  <p className="text-xs text-zinc-500 font-mono bg-zinc-800/50 px-2 py-1 rounded">
                    {settings.api_key_preview}
                  </p>
                )}

                <input
                  type="password"
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  placeholder="Enter new API key to update..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-zinc-500">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              <hr className="border-zinc-800" />

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400">About</h3>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>OpenManus LangGraph Agent</p>
                  <p>Powered by Claude AI</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {message && (
          <div
            className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="p-4 border-t border-zinc-700/50">
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              (!newApiKey.trim() && selectedModel === settings?.model)
            }
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
