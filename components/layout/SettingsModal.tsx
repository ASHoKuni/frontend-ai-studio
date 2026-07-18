"use client";

import { useState, useEffect } from "react";
import { clientConfig } from "@/lib/client-config";
import { X, Eye, EyeOff, CheckCircle2, ExternalLink, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [showOpenai, setShowOpenai] = useState(false);
  const [showFigma, setShowFigma] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing keys from localStorage on open
  useEffect(() => {
    if (open) {
      setOpenaiKey(clientConfig.getOpenAIKey());
      setFigmaToken(clientConfig.getFigmaToken());
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    clientConfig.setOpenAIKey(openaiKey);
    clientConfig.setFigmaToken(figmaToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    clientConfig.clearAll();
    setOpenaiKey("");
    setFigmaToken("");
  };

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center">
              <KeyRound className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">API Configuration</h2>
              <p className="text-[11px] text-zinc-500">Stored in your browser only</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Info banner */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 text-[11px] text-zinc-400 leading-relaxed">
            🔒 Keys are saved to <code className="text-zinc-300 bg-zinc-800 px-1 rounded">localStorage</code> and sent only to this app's own API routes. They are never logged or stored on any server.
          </div>

          {/* OpenAI Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <span className="text-base">🤖</span>
                OpenAI API Key
                <span className="text-[10px] text-red-400 font-normal">Required</span>
              </label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                Get key
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showOpenai ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-..."
                className={cn(
                  "w-full bg-zinc-800 border rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 transition-all font-mono pr-10",
                  openaiKey ? "border-violet-800/60" : "border-zinc-700"
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowOpenai((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {openaiKey && (
              <p className="text-[11px] text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Key entered
              </p>
            )}
          </div>

          {/* Figma Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <span className="text-base">🎨</span>
                Figma Access Token
                <span className="text-[10px] text-zinc-500 font-normal">Optional</span>
              </label>
              <a
                href="https://www.figma.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                Get token
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showFigma ? "text" : "password"}
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                placeholder="figd_..."
                className={cn(
                  "w-full bg-zinc-800 border rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 transition-all font-mono pr-10",
                  figmaToken ? "border-violet-800/60" : "border-zinc-700"
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowFigma((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showFigma ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Required for Figma URL import in Design to Code. Go to Figma → Settings → Personal Access Tokens.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-950/20"
          >
            Clear all
          </button>
          <button
            onClick={handleSave}
            className={cn(
              "ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
              saved
                ? "bg-green-700 text-white"
                : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30"
            )}
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              "Save Keys"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
