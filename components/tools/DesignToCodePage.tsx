"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Zap, Link2, ImageIcon, Download, Copy, RotateCcw, AlertCircle, Eye, Code2, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiHeaders } from "@/lib/client-config";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-sm">
      Loading code editor…
    </div>
  ),
});

type InputMode = "upload" | "url" | "figma";
type ViewMode  = "code"   | "preview";

function buildPreviewHtml(transpiledJs: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Enable all Tailwind features including arbitrary values
    tailwind.config = {
      theme: {
        extend: {}
      }
    }
  </script>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:24px;background:#09090b;min-height:100vh;font-family:ui-sans-serif,system-ui,sans-serif;color:#f4f4f5}
    #error{display:none;background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:16px;border-radius:8px;font-size:13px;font-family:monospace;white-space:pre-wrap}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error"></div>
  <script>
    window.__Module = {};
    window.addEventListener('error', function(e) {
      var el = document.getElementById('error');
      el.style.display = 'block';
      var msg = e.message || 'Unknown error';
      // Give a helpful hint for the most common generated-code mistake
      var hint = '';
      if (msg.includes("Cannot read properties of undefined") && msg.includes("map")) {
        hint = '\n\nHint: A list is undefined. Try regenerating — the component will embed sample data.';
      } else if (msg.includes("is not defined")) {
        hint = '\n\nHint: Try regenerating — a variable may not have been initialized.';
      }
      el.textContent = 'Runtime error: ' + msg + hint;
    });
    // Expose ALL React hooks and APIs as globals
    var _R = window.React;
    var useState = _R.useState, useEffect = _R.useEffect, useRef = _R.useRef,
        useCallback = _R.useCallback, useMemo = _R.useMemo,
        useContext = _R.useContext, useReducer = _R.useReducer,
        useLayoutEffect = _R.useLayoutEffect, useId = _R.useId,
        useTransition = _R.useTransition, useDeferredValue = _R.useDeferredValue,
        useImperativeHandle = _R.useImperativeHandle,
        createContext = _R.createContext, forwardRef = _R.forwardRef,
        memo = _R.memo, Fragment = _R.Fragment, createElement = _R.createElement;
  </script>
  <script>
    // esbuild-transpiled component (plain ES2017 JavaScript)
    try {
      ${transpiledJs}
    } catch(e) {
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = 'Load error: ' + e.message;
    }
  </script>
  <script>
    try {
      // Find the React component — prefer .default, then first uppercase-named function export
      var mod = window.__Module || {};
      var Component = mod.default
        || Object.values(mod).find(function(v) {
             return typeof v === 'function' && v.name && v.name[0] === v.name[0].toUpperCase() && v.name[0] !== v.name[0].toLowerCase();
           });
      if (Component) {
        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      } else {
        document.getElementById('root').innerHTML = '<p style="color:#a1a1aa;font-size:13px">No React component exported. Ensure your component has a named or default export.</p>';
      }
    } catch(e) {
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = 'Render error: ' + e.message;
    }
  </script>
</body>
</html>`;
}

export function DesignToCodePage() {
  const [mode, setMode] = useState<InputMode>("upload");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteError, setSiteError] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("code");
  const [previewKey, setPreviewKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [previewJs, setPreviewJs] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const hasImage = !!imageBase64;
  const canGenerate = hasImage && !isGenerating;

  // Drag & drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
    maxFiles: 1,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setImageBase64(b64);
        setImagePreview(b64);
        setGeneratedCode("");
      };
      reader.readAsDataURL(file);
    },
  });

  // Fetch Figma frame
  const fetchFigmaFrame = async () => {
    if (!figmaUrl.trim()) return;
    setFigmaLoading(true);
    setFigmaError("");
    setImageBase64(null);
    setImagePreview(null);

    try {
      const res = await fetch("/api/figma/image", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ figmaUrl: figmaUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFigmaError(data.error ?? "Failed to fetch Figma frame.");
        return;
      }
      setImageBase64(data.imageBase64);
      setImagePreview(data.imageBase64);
      setGeneratedCode("");
    } catch {
      setFigmaError("Network error. Please try again.");
    } finally {
      setFigmaLoading(false);
    }
  };

  // Transpile TypeScript → plain JS via esbuild API route, then show preview
  const transpileAndPreview = useCallback(async (code: string) => {
    setPreviewError("");
    setIframeLoading(true);
    setViewMode("preview");
    try {
      const res = await fetch("/api/preview/transpile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error ?? "Transpile failed");
        setIframeLoading(false);
        return;
      }
      setPreviewJs(data.js as string);
      setPreviewKey(k => k + 1);
    } catch {
      setPreviewError("Failed to reach transpile API.");
      setIframeLoading(false);
    }
  }, []);

  // Capture live website screenshot via Playwright
  const captureSiteUrl = async () => {
    if (!siteUrl.trim()) return;
    setSiteLoading(true);
    setSiteError("");
    setImageBase64(null);
    setImagePreview(null);
    setGeneratedCode("");
    try {
      const res = await fetch("/api/screenshot/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSiteError(data.error ?? "Screenshot failed.");
        return;
      }
      setImageBase64(data.imageBase64);
      setImagePreview(data.imageBase64);
    } catch { setSiteError("Network error. Check your connection."); }
    finally { setSiteLoading(false); }
  };

  // Generate code
  const handleGenerate = useCallback(async () => {
    if (!imageBase64 || isGenerating) return;
    setIsGenerating(true);
    setGeneratedCode("");
    setPreviewJs(null);
    setPreviewError("");

    let finalCode = "";
    try {
      const res = await fetch("/api/tools/design-to-code", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ imageBase64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        setGeneratedCode(`// Error: ${err.error}`);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGeneratedCode(accumulated);
      }
      finalCode = accumulated;
    } catch {
      setGeneratedCode("// Error: Failed to connect.");
    } finally {
      setIsGenerating(false);
    }

    // Extract clean code and auto-transpile + show preview
    if (finalCode) {
      const m = finalCode.match(/```(?:tsx?|jsx?)?\n([\s\S]*?)(?:```|$)/);
      const clean = m
        ? m[1].trim()
        : finalCode.replace(/^```(?:tsx?|jsx?)?\n?/, "").replace(/```$/, "").trim();

      // Sanity-check: must look like code, not a GPT apology / error text
      const looksLikeCode =
        clean.length > 20 &&
        (clean.includes("export") ||
          clean.includes("function") ||
          clean.includes("const ") ||
          clean.includes("return ("));

      if (clean && looksLikeCode) {
        transpileAndPreview(clean);
      } else if (clean) {
        setViewMode("preview");
        setPreviewError(
          "GPT returned a text response instead of code.\n\nResponse preview:\n" +
            clean.slice(0, 200) +
            "\n\nTry regenerating — the model may have refused the image or the prompt."
        );
      }
    }
  }, [imageBase64, isGenerating, transpileAndPreview]);

  // Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleGenerate]);

  // Extract clean TSX from streamed output (strips markdown code fence)
  const cleanCode = (() => {
    const match = generatedCode.match(/```(?:tsx?|jsx?)?\n([\s\S]*?)(?:```|$)/);
    return match ? match[1].trim() : generatedCode.replace(/^```(?:tsx?|jsx?)?\n?/, "").replace(/```$/, "").trim();
  })();

  // Build a blob URL from pre-transpiled JS — no Babel/CDN issues
  const previewBlobUrl = useMemo(() => {
    if (!previewJs) return "";
    const html = buildPreviewHtml(previewJs);
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [previewJs, previewKey]);

  // Revoke blob URL on change to prevent memory leaks
  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanCode || generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = cleanCode || generatedCode;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Component.tsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setImageBase64(null); setImagePreview(null);
    setFigmaUrl(""); setFigmaError("");
    setSiteUrl(""); setSiteError("");
    setGeneratedCode("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-lg shrink-0">
            🎨
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Design to Code</h2>
              <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full">
                New ✨
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Drop a screenshot or paste a Figma URL → complete React + Tailwind component
            </p>
          </div>
          <div className="ml-auto">
            <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
              Ctrl+Enter
            </kbd>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="w-5/12 flex flex-col border-r border-zinc-800 p-4 gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button
              onClick={() => { setMode("upload"); setSiteError(""); setFigmaError(""); }}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                mode === "upload" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
              <ImageIcon className="w-3.5 h-3.5" />Upload
            </button>
            <button
              onClick={() => { setMode("url"); setFigmaError(""); }}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                mode === "url" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
              <Globe className="w-3.5 h-3.5" />Live URL
            </button>
            <button
              onClick={() => { setMode("figma"); setSiteError(""); }}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                mode === "figma" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
              <Link2 className="w-3.5 h-3.5" />Figma URL
            </button>
          </div>

          {/* Live URL mode */}
          {mode === "url" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Website URL</label>
                <div className="flex gap-2">
                  <input
                    value={siteUrl}
                    onChange={(e) => { setSiteUrl(e.target.value); setSiteError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && captureSiteUrl()}
                    placeholder="https://stripe.com/pricing"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-700 transition-colors font-mono"
                  />
                  <Button
                    onClick={captureSiteUrl}
                    disabled={!siteUrl.trim() || siteLoading}
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
                  >
                    {siteLoading ? (
                      <span className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
                    ) : (
                      "Capture"
                    )}
                  </Button>
                </div>
              </div>
              {siteError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded-xl p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{siteError}</span>
                </div>
              )}
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Playwright launches a headless Chromium browser, navigates to the URL, and captures a 1440×900 screenshot. Works with any public website.
              </p>
            </div>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                isDragActive
                  ? "border-violet-500 bg-violet-950/20"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">{isDragActive ? "📥" : "🖼️"}</span>
                <p className="text-sm font-medium text-zinc-300">
                  {isDragActive ? "Drop it!" : "Drop a screenshot or click to upload"}
                </p>
                <p className="text-xs text-zinc-600">PNG · JPG · WEBP · up to 20MB</p>
              </div>
            </div>
          )}

          {/* Figma URL mode */}
          {mode === "figma" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Figma Frame URL</label>
                <div className="flex gap-2">
                  <input
                    value={figmaUrl}
                    onChange={(e) => { setFigmaUrl(e.target.value); setFigmaError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && fetchFigmaFrame()}
                    placeholder="https://www.figma.com/design/abc.../...?node-id=1-2"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-700 transition-colors font-mono"
                  />
                  <Button
                    onClick={fetchFigmaFrame}
                    disabled={!figmaUrl.trim() || figmaLoading}
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
                  >
                    {figmaLoading ? (
                      <span className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
                    ) : (
                      "Fetch"
                    )}
                  </Button>
                </div>
              </div>
              {figmaError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/40 rounded-xl p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{figmaError}</span>
                </div>
              )}
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Requires{" "}
                <code className="text-zinc-500 bg-zinc-800 px-1 rounded">FIGMA_ACCESS_TOKEN</code>{" "}
                in .env.local. Get yours at figma.com → Settings → Personal Access Tokens.
              </p>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0">
              <Image
                src={imagePreview}
                alt="Design preview"
                width={600}
                height={400}
                className="w-full h-auto max-h-48 object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
              <div className="absolute bottom-2 left-3 text-xs text-zinc-400 font-medium">
                Design loaded ✓
              </div>
              <button
                onClick={handleReset}
                className="absolute top-2 right-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-zinc-500 hover:text-zinc-300 h-8 px-2 text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
            >
              <Zap className="w-4 h-4 mr-1.5" />
              {isGenerating ? "Generating…" : "Generate Component"}
            </Button>
          </div>
        </div>

        {/* Right: Code / Preview output */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/30" ref={outputRef}>
          {/* Output toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
            {/* Code / Preview tab toggle */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("code")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150",
                  viewMode === "code" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Code2 className="w-3 h-3" /> Code
              </button>
              <button
                onClick={() => {
                  if (cleanCode) transpileAndPreview(cleanCode);
                }}
                disabled={!cleanCode || isGenerating}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150",
                  viewMode === "preview" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300",
                  (!cleanCode || isGenerating) && "opacity-40 cursor-not-allowed"
                )}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isGenerating && (
                <div className="flex items-center gap-1.5 text-xs text-violet-400">
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                  Generating…
                </div>
              )}
              {cleanCode && !isGenerating && (
                <>
                  {viewMode === "preview" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (cleanCode) transpileAndPreview(cleanCode); }}
                      className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1"
                      title="Refresh preview"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleCopy}
                    className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
                    <Copy className="w-3 h-3" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownload}
                    className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs gap-1">
                    <Download className="w-3 h-3" />
                    .tsx
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden relative">
            {!generatedCode && !isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl opacity-40">🎨</div>
                <div>
                  <p className="text-zinc-500 text-sm font-medium">No code generated yet</p>
                  <p className="text-zinc-600 text-xs mt-1 max-w-xs leading-relaxed">
                    Upload a screenshot or fetch a Figma frame, then press{" "}
                    <kbd className="text-zinc-500 border border-zinc-700 rounded px-1 font-mono text-[10px]">Ctrl+Enter</kbd>
                  </p>
                </div>
              </div>
            ) : viewMode === "code" ? (
              /* ── Code view ── */
              <MonacoEditor
                height="100%"
                language="typescript"
                theme="vs-dark"
                value={isGenerating ? generatedCode : (cleanCode || generatedCode)}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12.5,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "none",
                  smoothScrolling: true,
                  cursorStyle: "line",
                  domReadOnly: true,
                }}
              />
            ) : (
              /* ── Preview view ── */
              <div className="w-full h-full relative bg-zinc-950">
                {iframeLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 backdrop-blur-sm">
                    <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
                    <p className="text-xs text-zinc-300 font-medium">Transpiling + rendering…</p>
                    <p className="text-[11px] text-zinc-600 max-w-[200px] text-center leading-relaxed">esbuild → React + Tailwind</p>
                  </div>
                )}
                {previewError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6">
                    <div className="bg-red-950/60 border border-red-900/50 rounded-xl p-4 max-w-md w-full">
                      <p className="text-xs font-semibold text-red-400 mb-2">Transpile Error</p>
                      <pre className="text-[11px] text-red-300 whitespace-pre-wrap font-mono leading-relaxed">{previewError}</pre>
                      <button onClick={() => setPreviewError("")} className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-300 underline">Dismiss</button>
                    </div>
                  </div>
                )}
                {previewBlobUrl && !previewError ? (
                  <iframe
                    key={previewKey}
                    src={previewBlobUrl}
                    className="w-full h-full border-0"
                    title="Live Component Preview"
                    onLoad={() => setIframeLoading(false)}
                  />
                ) : !previewError && (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                    Building preview…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
