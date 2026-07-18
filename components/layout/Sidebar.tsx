"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { clientConfig } from "@/lib/client-config";
import { SettingsModal } from "./SettingsModal";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    setHasKeys(clientConfig.hasOpenAIKey());
    const onStorage = () => setHasKeys(clientConfig.hasOpenAIKey());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [settingsOpen]); // re-check after modal closes

  return (
    <aside className="w-64 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Logo — links to home */}
      <div className="p-5 border-b border-zinc-800">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🧠</span>
          <div>
            <h1 className="font-bold text-sm text-white leading-tight">Frontend AI Studio</h1>
            <p className="text-xs text-zinc-500">9 AI-powered tools</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {TOOLS.map((tool) => {
          const isActive = pathname === `/tools/${tool.id}`;
          return (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <span className="text-base shrink-0">{tool.icon}</span>
              <span className="truncate font-medium">{tool.name}</span>
              {tool.badge && (
                <span className="ml-auto text-[10px] bg-violet-900/60 text-violet-300 px-1.5 py-0.5 rounded-full shrink-0">
                  {tool.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800 space-y-2">
        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
            hasKeys
              ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              : "text-amber-400 hover:text-amber-300 hover:bg-amber-950/30"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="font-medium truncate">API Keys</span>
          <span
            className={cn(
              "ml-auto w-2 h-2 rounded-full shrink-0",
              hasKeys ? "bg-green-500" : "bg-amber-400"
            )}
          />
        </button>
        <p className="text-[10px] text-zinc-700 text-center px-2">
          Powered by OpenAI GPT-4o
        </p>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
