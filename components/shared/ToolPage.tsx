"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Tool } from "@/lib/tools";
import { AIOutput } from "@/components/shared/AIOutput";
import { CodeEditor } from "@/components/shared/CodeEditor";
import { FileUpload } from "@/components/shared/FileUpload";
import { Button } from "@/components/ui/button";
import { Copy, RotateCcw, Zap, FlaskConical, Eye, Code2, RefreshCw, Download } from "lucide-react";
import { getApiHeaders } from "@/lib/client-config";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-sm">
      Loading editor…
    </div>
  ),
});

interface ToolPageProps { tool: Tool; }
type ViewMode = "output" | "code" | "preview";

function buildPreviewHtml(js: string): string {
  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{}}}</script>
  <style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#09090b;min-height:100vh;font-family:ui-sans-serif,system-ui,sans-serif;color:#f4f4f5}
  #err{display:none;background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:16px;border-radius:8px;font-size:13px;font-family:monospace;white-space:pre-wrap}</style>
  </head><body><div id="root"></div><div id="err"></div>
  <script>window.__Module={};window.addEventListener('error',function(e){var d=document.getElementById('err');d.style.display='block';d.textContent='Error: '+e.message;});
  var R=window.React;var useState=R.useState,useEffect=R.useEffect,useRef=R.useRef,useCallback=R.useCallback,useMemo=R.useMemo,useContext=R.useContext,useReducer=R.useReducer,useLayoutEffect=R.useLayoutEffect,useId=R.useId,createContext=R.createContext,forwardRef=R.forwardRef,memo=R.memo,Fragment=R.Fragment;</script>
  <script>try{${js}}catch(e){var d=document.getElementById('err');d.style.display='block';d.textContent='Load: '+e.message;}</script>
  <script>try{var m=window.__Module||{};var C=m.default||Object.values(m).find(function(v){return typeof v==='function'&&v.name&&v.name[0]===v.name[0].toUpperCase()&&v.name[0]!==v.name[0].toLowerCase();});if(C){ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(C));}else{document.getElementById('root').innerHTML='<p style="color:#a1a1aa;font-size:13px">No component exported.</p>';}}catch(e){var d=document.getElementById('err');d.style.display='block';d.textContent='Render: '+e.message;}</script>
  </body></html>`;
}

export function ToolPage({ tool }: ToolPageProps) {
  const [input, setInput] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("output");
  const [previewJs, setPreviewJs] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const isComp = tool.id === "component";
  const hasInput = tool.inputType === "image" ? !!imageBase64 : input.trim().length > 0;

  const cleanCode = (() => {
    const m = output.match(/```(?:tsx?|jsx?)?\n([\s\S]*?)(?:```|$)/);
    return m ? m[1].trim() : output.replace(/^```(?:tsx?|jsx?)?\n?/, "").replace(/```$/, "").trim();
  })();

  const transpileAndPreview = useCallback(async (code: string) => {
    setPreviewError(""); setIframeLoading(true); setViewMode("preview");
    try {
      const res = await fetch("/api/preview/transpile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setPreviewError(data.error ?? "Transpile failed"); setIframeLoading(false); return; }
      setPreviewJs(data.js as string);
      setPreviewKey(k => k + 1);
    } catch { setPreviewError("Failed to reach transpile API."); setIframeLoading(false); }
  }, []);

  const previewBlobUrl = useMemo(() => {
    if (!previewJs) return "";
    return URL.createObjectURL(new Blob([buildPreviewHtml(previewJs)], { type: "text/html" }));
  }, [previewJs, previewKey]);

  useEffect(() => { return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); }; }, [previewBlobUrl]);

  const handleAnalyze = useCallback(async () => {
    if (!hasInput || isLoading) return;
    setIsLoading(true); setOutput(""); setPreviewJs(null); setPreviewError("");
    if (isComp) setViewMode("code");
    let final = "";
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: "POST", headers: getApiHeaders(),
        body: JSON.stringify({ input: input.trim(), imageBase64 }),
      });
      if (!res.ok) { const e = await res.json(); setOutput(`**Error:** ${e.error ?? "Check your API key."}`); return; }
      const reader = res.body?.getReader(); const dec = new TextDecoder();
      if (!reader) return;
      let acc = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); setOutput(acc); }
      final = acc;
    } catch { setOutput("**Error:** Failed to connect."); }
    finally { setIsLoading(false); }
    if (isComp && final) {
      const m = final.match(/```(?:tsx?|jsx?)?\n([\s\S]*?)(?:```|$)/);
      const c = m ? m[1].trim() : final.replace(/^```(?:tsx?|jsx?)?\n?/, "").replace(/```$/, "").trim();
      if (c.length > 20 && (c.includes("export") || c.includes("function") || c.includes("return ("))) transpileAndPreview(c);
    }
  }, [hasInput, isLoading, tool.id, input, imageBase64, isComp, transpileAndPreview]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleAnalyze(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [handleAnalyze]);

  const handleCopy = async () => { await navigator.clipboard.writeText(isComp && cleanCode ? cleanCode : output); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownload = () => { const c = cleanCode || output; const u = URL.createObjectURL(new Blob([c], { type: "text/plain" })); const a = document.createElement("a"); a.href = u; a.download = "Component.tsx"; a.click(); URL.revokeObjectURL(u); };
  const handleReset = () => { setInput(""); setImageBase64(null); setOutput(""); setPreviewJs(null); setPreviewError(""); setViewMode("output"); };
  const handleLoadSample = () => { if (tool.sample) setInput(tool.sample); };

  const chars = input.length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-lg shrink-0">{tool.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white truncate">{tool.name}</h2>
              {tool.badge && <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full shrink-0">{tool.badge}</span>}
            </div>
            <p className="text-xs text-zinc-500 truncate">{tool.description}</p>
          </div>
          <div className="ml-auto shrink-0"><kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">Ctrl+Enter</kbd></div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="w-1/2 flex flex-col border-r border-zinc-800 p-4 gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Input</span>
            <div className="flex items-center gap-2">
              {tool.sample && tool.inputType !== "image" && (
                <Button variant="ghost" size="sm" onClick={handleLoadSample} className="text-violet-400 hover:text-violet-300 hover:bg-violet-950/40 h-7 px-2 text-xs gap-1">
                  <FlaskConical className="w-3 h-3" />Load Sample
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
                <RotateCcw className="w-3 h-3" />Reset
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {tool.inputType === "image" ? <FileUpload onFileSelect={(_, b) => setImageBase64(b)} />
              : tool.inputType === "code" ? <CodeEditor value={input} onChange={setInput} height="100%" placeholder={tool.placeholder} />
              : <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={tool.placeholder}
                  className="w-full h-full min-h-[200px] bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-700 font-mono leading-relaxed transition-colors" />
            }
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {tool.inputType !== "image" && <span className="text-[11px] text-zinc-600 tabular-nums">{chars > 0 ? `${chars.toLocaleString()} chars · ${words.toLocaleString()} words` : ""}</span>}
            <Button onClick={handleAnalyze} disabled={!hasInput || isLoading} className="ml-auto bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 shadow-lg shadow-violet-900/30 px-5">
              <Zap className="w-4 h-4 mr-1.5" />{isLoading ? "Generating…" : isComp ? "Generate" : "Analyze"}
            </Button>
          </div>
        </div>

        {/* Right: Output */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-zinc-950/30">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
            {isComp ? (
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button onClick={() => setViewMode("code")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all", viewMode === "code" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
                  <Code2 className="w-3 h-3" />Code
                </button>
                <button onClick={() => { if (cleanCode) transpileAndPreview(cleanCode); }} disabled={!cleanCode || isLoading}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all", viewMode === "preview" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300", (!cleanCode || isLoading) && "opacity-40 cursor-not-allowed")}>
                  <Eye className="w-3 h-3" />Preview
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">AI Output</span>
            )}
            <div className="flex items-center gap-2">
              {isLoading && <div className="flex items-center gap-1.5 text-xs text-violet-400"><span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />Streaming…</div>}
              {isComp && viewMode === "preview" && cleanCode && !isLoading && (
                <Button variant="ghost" size="sm" onClick={() => { if (cleanCode) transpileAndPreview(cleanCode); }} className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
              {output && !isLoading && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
                    <Copy className="w-3 h-3" />{copied ? "Copied!" : "Copy"}
                  </Button>
                  {isComp && cleanCode && (
                    <Button variant="ghost" size="sm" onClick={handleDownload} className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
                      <Download className="w-3 h-3" />.tsx
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto relative" ref={outputRef}>
            {!output && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl opacity-40">{tool.icon}</div>
                <div>
                  <p className="text-zinc-500 text-sm font-medium">No output yet</p>
                  <p className="text-zinc-600 text-xs mt-1 max-w-xs">{tool.inputType === "image" ? "Upload a screenshot and press Analyze" : "Add input on the left, then press Analyze or Ctrl+Enter"}</p>
                </div>
                {tool.sample && tool.inputType !== "image" && (
                  <button onClick={handleLoadSample} className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2">or try the sample →</button>
                )}
              </div>
            )}

            {output && isComp && viewMode === "code" && (
              <MonacoEditor height="100%" language="typescript" theme="vs-dark" value={isLoading ? output : (cleanCode || output)}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 16, bottom: 16 }, renderLineHighlight: "none", smoothScrolling: true, domReadOnly: true }} />
            )}

            {isComp && viewMode === "preview" && (
              <div className="w-full h-full relative bg-zinc-950">
                {iframeLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
                    <p className="text-xs text-zinc-300 font-medium">Transpiling + rendering…</p>
                  </div>
                )}
                {previewError && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
                    <div className="bg-red-950/60 border border-red-900/50 rounded-xl p-4 max-w-md w-full">
                      <p className="text-xs font-semibold text-red-400 mb-2">Preview Error</p>
                      <pre className="text-[11px] text-red-300 whitespace-pre-wrap font-mono">{previewError}</pre>
                      <button onClick={() => setPreviewError("")} className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-300 underline">Dismiss</button>
                    </div>
                  </div>
                )}
                {previewBlobUrl && !previewError && (
                  <iframe key={previewKey} src={previewBlobUrl} className="w-full h-full border-0" title="Live Preview" onLoad={() => setIframeLoading(false)} />
                )}
              </div>
            )}

            {output && !isComp && <AIOutput content={output} isLoading={isLoading} />}
          </div>
        </div>
      </div>
    </div>
  );
}


