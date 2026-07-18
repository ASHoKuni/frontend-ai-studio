"use client";

import { useState, useRef, useCallback } from "react";
import React from "react";
import type JSZipType from "jszip";
import { PackageSize } from "@/app/api/bundle/sizes/route";
import { AnalyzedFile, GitHubAnalysisResult } from "@/app/api/github/analyze/route";
import { AIOutput } from "@/components/shared/AIOutput";
import { Button } from "@/components/ui/button";
import { getApiHeaders } from "@/lib/client-config";
import { TOOLS } from "@/lib/tools";
import { ExternalLink, GitBranch, Upload, FileCode2, RotateCcw, Zap, CheckCircle2, Loader2, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const PASTE_SAMPLE = TOOLS.find((t) => t.id === "bundle")?.sample ?? "";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function severity(gzip: number): "heavy" | "moderate" | "light" {
  if (gzip >= 80 * 1024) return "heavy";
  if (gzip >= 20 * 1024) return "moderate";
  return "light";
}

const SEV = {
  heavy:    { bar: "bg-red-500",     badge: "bg-red-950/60 text-red-400 border-red-900/40",       label: "Heavy" },
  moderate: { bar: "bg-amber-500",   badge: "bg-amber-950/60 text-amber-400 border-amber-900/40", label: "Moderate" },
  light:    { bar: "bg-emerald-500", badge: "bg-emerald-950/60 text-emerald-400 border-emerald-900/40", label: "OK" },
};

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ packages }: { packages: PackageSize[] }) {
  const found = packages.filter(p => p.found);
  const heavy    = found.filter(p => p.gzip >= 80   * 1024).length;
  const moderate = found.filter(p => p.gzip >= 20   * 1024 && p.gzip < 80 * 1024).length;
  const light    = found.filter(p => p.gzip < 20 * 1024).length;
  const total    = found.length;
  if (total === 0) return null;

  const r = 30; const c = 2 * Math.PI * r;
  const segs = [
    { value: heavy,    color: "#ef4444" },
    { value: moderate, color: "#f59e0b" },
    { value: light,    color: "#10b981" },
  ].filter(s => s.value > 0);

  let off = 0;
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76" className="rotate-[-90deg]">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#27272a" strokeWidth="8"/>
        {segs.map((seg, i) => {
          const dash = (seg.value / total) * c;
          const el = <circle key={i} cx="38" cy="38" r={r} fill="none" stroke={seg.color}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`} strokeDashoffset={-off} />;
          off += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-white leading-none">{total}</span>
        <span className="text-[9px] text-zinc-500 leading-none mt-0.5">pkgs</span>
      </div>
    </div>
  );
}

// ─── Health grade ─────────────────────────────────────────────────────────────

function getGrade(heavyCount: number, total: number) {
  if (total === 0) return { grade: "—", cls: "text-zinc-500 border-zinc-700" };
  const pct = heavyCount / total;
  if (pct === 0)    return { grade: "A", cls: "text-emerald-300 border-emerald-600" };
  if (pct <= 0.1)   return { grade: "B", cls: "text-green-300   border-green-600"   };
  if (pct <= 0.2)   return { grade: "C", cls: "text-amber-300   border-amber-500"   };
  if (pct <= 0.35)  return { grade: "D", cls: "text-orange-300  border-orange-500"  };
  return                    { grade: "F", cls: "text-red-300     border-red-500"     };
}

// ─── Before/After extractor from streamed GPT text ────────────────────────────

function extractSummary(text: string): { before: string; after: string; savings: string } | null {
  // Match table row like: | Bundle Size | 2.5MB | 1.3MB | 48% |
  const m = text.match(/Bundle\s*Size[\s|]+([0-9.]+\s*(?:MB|KB|GB|B))[\s|]+([0-9.]+\s*(?:MB|KB|GB|B))[\s|]+(-?[0-9]+%)/i);
  if (m) return { before: m[1].trim(), after: m[2].trim(), savings: m[3].trim() };
  return null;
}

// ─── Report section card ──────────────────────────────────────────────────────

interface Section { heading: string; color: "red"|"amber"|"green"|"blue"|"zinc"; body: string; }

function parseSections(text: string): Section[] {
  const colorMap: Record<string, Section["color"]> = {
    "🔴": "red", "🟡": "amber", "🟢": "green", "📁": "blue",
    "🗺": "zinc", "📊": "zinc", "📈": "green",
  };
  const sections: Section[] = [];
  const parts = text.split(/\n(?=##\s)/);
  for (const part of parts) {
    const headingMatch = part.match(/^##\s+(.+)/);
    if (!headingMatch) continue;
    const heading = headingMatch[1].trim();
    const emoji = heading.slice(0, 2);
    const color = colorMap[emoji] ?? "zinc";
    const body = part.replace(/^##\s+.+\n?/, "").trim();
    if (body) sections.push({ heading, color, body });
  }
  return sections;
}

const SECTION_STYLES: Record<Section["color"], { border: string; badge: string; dot: string }> = {
  red:   { border: "border-red-900/40   bg-red-950/10",   badge: "bg-red-900/40   text-red-300   border-red-800/60",   dot: "bg-red-400"   },
  amber: { border: "border-amber-900/40 bg-amber-950/10", badge: "bg-amber-900/40 text-amber-300 border-amber-800/60", dot: "bg-amber-400" },
  green: { border: "border-emerald-900/40 bg-emerald-950/10", badge: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60", dot: "bg-emerald-400" },
  blue:  { border: "border-blue-900/40  bg-blue-950/10",  badge: "bg-blue-900/40  text-blue-300  border-blue-800/60",  dot: "bg-blue-400"  },
  zinc:  { border: "border-zinc-800     bg-zinc-900/30",  badge: "bg-zinc-800     text-zinc-300  border-zinc-700",     dot: "bg-zinc-500"  },
};

// ─── ReportSection: renders a single GPT section body as structured cards ─────

function ReportSection({ text, color }: { text: string; color: Section["color"] }) {
  const st = SECTION_STYLES[color];

  // Split the text by "**Package**:" blocks to detect individual issue items
  const issueBlocks = text.split(/(?=\*\*Package\*\*:)/);

  if (issueBlocks.length > 1) {
    // Render as issue cards
    return (
      <div className="space-y-3">
        {issueBlocks.filter(b => b.trim()).map((block, i) => {
          // Extract Package, Problem, File(s), Fix, Code fields
          const get = (key: string) => {
            const m = block.match(new RegExp(`\\*\\*${key}\\*\\*:?\\s*(.+?)(?=\\n\\*\\*|\\n\\n|$)`, "is"));
            return m ? m[1].trim() : "";
          };
          const pkg     = get("Package");
          const problem = get("Problem");
          const files   = get("File(?:s)?");
          const fix     = get("Fix");
          const code    = block.match(/```[\s\S]*?```/)?.[0] ?? get("Code");

          if (!pkg) return null;

          return (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2">
              {/* Package name + size */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs border px-2 py-0.5 rounded-full font-mono font-medium", st.badge)}>
                  {pkg}
                </span>
              </div>
              {/* Problem */}
              {problem && (
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-zinc-500 font-medium">Problem: </span>{problem}
                </p>
              )}
              {/* Files */}
              {files && (
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <span className="text-zinc-500 font-medium">Files: </span>
                  <code className="text-blue-300 bg-zinc-800 px-1 rounded text-[11px]">{files}</code>
                </p>
              )}
              {/* Fix */}
              {fix && (
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-zinc-500 font-medium">Fix: </span>{fix}
                </p>
              )}
              {/* Code block */}
              {code && code.includes("```") && (
                <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 text-[11px] text-violet-300 font-mono overflow-x-auto">
                  {code.replace(/```(?:tsx?|js|bash)?\n?/g, "").replace(/```$/g, "").trim()}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: render as styled markdown-like text
  return (
    <div className="text-xs text-zinc-300 space-y-1.5 leading-relaxed">
      {text.split("\n").filter(Boolean).map((line, i) => {
        if (line.startsWith("```")) return null;
        const isCode = /^\s{4}|\t/.test(line);
        const isListItem = /^[-*\d]/.test(line.trim());
        const cleaned = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
        return (
          <p key={i} className={cn(
            isCode ? "font-mono text-[11px] text-violet-300 bg-zinc-900 px-2 py-0.5 rounded" :
            isListItem ? "pl-3 border-l-2 border-zinc-700 text-zinc-300" :
            "text-zinc-400"
          )}>
            {cleaned}
          </p>
        );
      })}
    </div>
  );
}

type InputMode = "github" | "zip" | "paste";

interface Step { id: string; label: string; status: "pending"|"loading"|"done"|"error"; detail?: string; }

function extractImportsClient(code: string): string[] {
  const imports = new Set<string>();
  const re = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const raw = m[1];
    if (raw.startsWith(".") || raw.startsWith("/")) continue;
    const name = raw.startsWith("@") ? raw.split("/").slice(0,2).join("/") : raw.split("/")[0];
    if (name) imports.add(name);
  }
  return [...imports];
}

export function BundleAnalyzerPage() {
  const [mode, setMode] = useState<InputMode>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [packages, setPackages] = useState<PackageSize[] | null>(null);
  const [analysisInfo, setAnalysisInfo] = useState<{ repoName: string; totalFiles: number; analyzedFiles: AnalyzedFile[]; } | null>(null);
  const [aiReport, setAiReport] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalGzip = packages?.filter(p=>p.found).reduce((s,p)=>s+p.gzip,0) ?? 0;
  const maxGzip   = packages?.filter(p=>p.found).reduce((m,p)=>Math.max(m,p.gzip),1) ?? 1;
  const heavyCount = packages?.filter(p=>p.found && severity(p.gzip)==="heavy").length ?? 0;
  const isDone = !!aiReport && !isRunning;

  const updateStep = (id: string, status: Step["status"], detail?: string) =>
    setSteps(prev => prev.map(s => s.id===id ? {...s, status, detail} : s));

  const reset = () => { setSteps([]); setPackages(null); setAnalysisInfo(null); setAiReport(""); setError(""); setIsRunning(false); };

  const runPipeline = useCallback(async (
    deps: Record<string,string>, analyzedFiles: AnalyzedFile[], repoName: string, totalFiles: number
  ) => {
    const allNames = new Set<string>([...Object.keys(deps), ...analyzedFiles.flatMap(f=>f.imports)]);
    setSteps(p=>p.map(s=>s.id==="sizes"?{...s,status:"loading",detail:`Looking up ${allNames.size} packages…`}:s));

    const sizesRes = await fetch("/api/bundle/sizes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names:[...allNames]})});
    if (!sizesRes.ok) { const e = await sizesRes.json().catch(()=>({})); setError((e as {error?:string}).error??"Failed to fetch bundle sizes."); return; }
    const { packages: pkgs } = await sizesRes.json() as { packages: PackageSize[] };
    setPackages(pkgs);
    const found = pkgs.filter(p=>p.found);
    updateStep("sizes","done",`${found.length} packages sized · ${formatBytes(found.reduce((s,p)=>s+p.gzip,0))} total`);
    updateStep("report","loading","GPT-4o reading real size data…");
    setAnalysisInfo({ repoName, totalFiles, analyzedFiles });

    const reportRes = await fetch("/api/bundle/report",{method:"POST",headers:getApiHeaders(),body:JSON.stringify({packages:pkgs,analyzedFiles,repoName,totalFiles})});
    if (!reportRes.ok) { const e=await reportRes.json(); setAiReport(`**Error:** ${e.error}`); updateStep("report","error"); return; }

    updateStep("report","loading","Streaming priority report…");
    const reader = reportRes.body?.getReader(); const decoder = new TextDecoder();
    if (!reader) return;
    let acc = "";
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      acc += decoder.decode(value,{stream:true}); setAiReport(acc);
      reportRef.current?.scrollIntoView({behavior:"smooth",block:"end"});
    }
    updateStep("report","done","Report complete");
  }, []);

  const handleGitHub = async () => {
    if (!githubUrl.trim() || isRunning) return;
    reset(); setIsRunning(true); setError("");
    setSteps([
      {id:"repo",  label:"Fetching repository structure",status:"loading"},
      {id:"files", label:"Reading source files",        status:"pending"},
      {id:"sizes", label:"Fetching real bundle sizes",  status:"pending"},
      {id:"report",label:"Generating priority report",  status:"pending"},
    ]);
    try {
      const ghRes = await fetch("/api/github/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({githubUrl:githubUrl.trim()})});
      if (!ghRes.ok) { const e=await ghRes.json(); setError(e.error??"GitHub fetch failed."); updateStep("repo","error"); return; }
      const gh = await ghRes.json() as GitHubAnalysisResult;
      updateStep("repo","done",`${gh.repoName} · ${gh.totalFiles} source files`);
      updateStep("files","loading",`Analyzing ${gh.analyzedFiles.length} files…`);
      updateStep("files","done",`${gh.analyzedFiles.length} files analyzed · ${Object.keys(gh.dependencies).length} dependencies`);
      updateStep("sizes","pending");
      await runPipeline({...gh.dependencies,...gh.devDependencies}, gh.analyzedFiles, gh.repoName, gh.totalFiles);
    } finally { setIsRunning(false); }
  };

  const handleZip = async (file: File) => {
    reset(); setIsRunning(true); setError("");
    setSteps([
      {id:"zip",   label:"Extracting ZIP contents",    status:"loading"},
      {id:"files", label:"Parsing source files",       status:"pending"},
      {id:"sizes", label:"Fetching real bundle sizes", status:"pending"},
      {id:"report",label:"Generating priority report", status:"pending"},
    ]);
    try {
      const JSZip = (await import("jszip")).default as typeof JSZipType;
      const zip = await JSZip.loadAsync(file);
      let deps: Record<string,string>={}, devDeps: Record<string,string>={};
      const pkgFile = Object.values(zip.files).find(f=>f.name.endsWith("package.json")&&!f.name.includes("node_modules"));
      if (pkgFile) { const c=await pkgFile.async("string"); const p=JSON.parse(c); deps=p.dependencies??{}; devDeps=p.devDependencies??{}; }
      updateStep("zip","done",`${Object.keys(zip.files).length} files extracted`);
      updateStep("files","loading","Reading imports…");
      const srcFiles = Object.values(zip.files).filter(f=>!f.dir&&!f.name.includes("node_modules/")&&[".ts",".tsx",".js",".jsx"].some(e=>f.name.endsWith(e))).slice(0,25);
      const analyzed: AnalyzedFile[] = [];
      for (const f of srcFiles) { const c=await f.async("string"); const imp=extractImportsClient(c); if(imp.length>0) analyzed.push({path:f.name,imports:imp,size:c.length}); }
      updateStep("files","done",`${analyzed.length} files parsed · ${Object.keys(deps).length} deps`);
      await runPipeline({...deps,...devDeps}, analyzed, file.name.replace(".zip",""), srcFiles.length);
    } catch(e) { setError(e instanceof Error?e.message:"Failed to read ZIP."); updateStep("zip","error"); }
    finally { setIsRunning(false); }
  };

  const handlePaste = async (src?: string) => {
    const input=(src??pasteInput).trim(); if(!input||isRunning) return;
    reset(); setIsRunning(true); setError("");
    setSteps([{id:"sizes",label:"Fetching real bundle sizes",status:"pending"},{id:"report",label:"Generating priority report",status:"pending"}]);
    try {
      // Parse package names client-side first, then send as array
      let deps: Record<string,string>={};
      const clientImports = extractImportsClient(input);
      try { const j=JSON.parse(input); deps={...j.dependencies??{},...j.devDependencies??{}}; } catch{/*ignore*/}
      const allNames = [...new Set([...Object.keys(deps), ...clientImports])].filter(Boolean);
      await runPipeline(deps,[{path:"pasted-input",imports:allNames,size:input.length}],"pasted-project",0);
    } finally { setIsRunning(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-lg shrink-0">📦</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Bundle Analyzer</h2>
              <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">Full Project</span>
            </div>
            <p className="text-xs text-zinc-500">GitHub URL · ZIP upload · or paste — real sizes + file-by-file priority report</p>
          </div>
          {(packages||aiReport) && <Button variant="ghost" size="sm" onClick={reset} className="ml-auto text-zinc-500 hover:text-zinc-300 h-8 gap-1 text-xs"><RotateCcw className="w-3 h-3"/>New Analysis</Button>}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isRunning && !packages && (
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-4">
              {([["github",GitBranch,"GitHub URL"],["zip",Upload,"Upload ZIP"],["paste",FileCode2,"Paste Code"]] as [InputMode, React.ElementType, string][]).map(([m,Icon,label])=>(
                <button key={m} onClick={()=>setMode(m)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",mode===m?"bg-zinc-700 text-white shadow":"text-zinc-500 hover:text-zinc-300")}>
                  <Icon className="w-3.5 h-3.5"/>{label}
                </button>
              ))}
            </div>
            {mode==="github" && (
              <div className="flex gap-3">
                <input value={githubUrl} onChange={e=>setGithubUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleGitHub()}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 font-mono transition-colors"/>
                <Button onClick={handleGitHub} disabled={!githubUrl.trim()} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-900/30 px-5">
                  <Zap className="w-4 h-4 mr-1.5"/>Analyze
                </Button>
              </div>
            )}
            {mode==="zip" && (
              <div>
                <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleZip(f);}}/>
                <button onClick={()=>fileInputRef.current?.click()} className="w-full border-2 border-dashed border-zinc-700 hover:border-violet-600/50 rounded-xl p-8 text-center transition-all hover:bg-violet-950/10 group">
                  <Upload className="w-8 h-8 text-zinc-600 group-hover:text-violet-400 mx-auto mb-2 transition-colors"/>
                  <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">Click to upload project ZIP</p>
                  <p className="text-xs text-zinc-600 mt-1">Zip your project folder — exclude node_modules</p>
                </button>
              </div>
            )}
            {mode==="paste" && (
              <div className="flex gap-3 items-start">
                <textarea value={pasteInput} onChange={e=>setPasteInput(e.target.value)} placeholder="Paste package.json or import statements…" rows={4}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-600/50 font-mono"/>
                <div className="flex flex-col gap-2">
                  <Button onClick={()=>handlePaste()} disabled={!pasteInput.trim()} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-900/30"><Zap className="w-4 h-4 mr-1.5"/>Analyze</Button>
                  <Button variant="ghost" size="sm" onClick={()=>{setPasteInput(PASTE_SAMPLE);handlePaste(PASTE_SAMPLE);}} className="text-violet-400 hover:text-violet-300 hover:bg-violet-950/40 text-xs">Load Sample</Button>
                </div>
              </div>
            )}
            {error && <p className="mt-3 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2">{error}</p>}
          </div>
        )}

        {steps.length>0 && !packages && (
          <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/20 shrink-0">
            <div className="space-y-3 max-w-lg">
              {steps.map(step=>(
                <div key={step.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {step.status==="done"    && <CheckCircle2 className="w-4 h-4 text-green-400"/>}
                    {step.status==="loading" && <Loader2 className="w-4 h-4 text-violet-400 animate-spin"/>}
                    {step.status==="pending" && <div className="w-4 h-4 rounded-full border border-zinc-700"/>}
                    {step.status==="error"   && <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-600"/>}
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium",step.status==="done"?"text-zinc-300":step.status==="loading"?"text-white":step.status==="error"?"text-red-400":"text-zinc-600")}>{step.label}</p>
                    {step.detail && <p className="text-xs text-zinc-500 mt-0.5">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isRunning && !packages && steps.length===0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center opacity-40"><PackageOpen className="w-8 h-8 text-zinc-500"/></div>
            <div>
              <p className="text-zinc-500 text-sm font-medium">Full-project bundle analysis</p>
              <p className="text-zinc-600 text-xs mt-1 max-w-sm leading-relaxed">Connect a GitHub repo, upload a ZIP, or paste imports — get real sizes + a file-by-file priority report</p>
            </div>
            <div className="flex gap-4">
              <button onClick={()=>{setMode("github");setGithubUrl("https://github.com/vercel/next.js");}} className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2">Try next.js →</button>
              <button onClick={()=>{setMode("paste");setPasteInput(PASTE_SAMPLE);handlePaste(PASTE_SAMPLE);}} className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2">Try sample →</button>
            </div>
          </div>
        )}

        {packages && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[390px] shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
              {/* Chart header */}
              <div className="px-4 py-4 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
                <div className="flex items-center gap-4">
                  <DonutChart packages={packages} />
                  <div className="flex-1 min-w-0">
                    {/* Health grade */}
                    {(() => {
                      const { grade, cls } = getGrade(heavyCount, packages.filter(p=>p.found).length);
                      return (
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("w-9 h-9 rounded-lg border-2 flex items-center justify-center font-bold text-lg shrink-0", cls)}>
                            {grade}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-zinc-300">Bundle Health</p>
                            <p className="text-[10px] text-zinc-500">
                              {heavyCount > 0 ? `${heavyCount} heavy package${heavyCount>1?"s":""} need attention` : "Looking good!"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        { label: "Heavy",    color: "bg-red-500",     count: packages.filter(p=>p.found && p.gzip >= 80*1024).length },
                        { label: "Moderate", color: "bg-amber-500",   count: packages.filter(p=>p.found && p.gzip >= 20*1024 && p.gzip < 80*1024).length },
                        { label: "OK",       color: "bg-emerald-500", count: packages.filter(p=>p.found && p.gzip < 20*1024).length },
                      ].map(({ label, color, count }) => (
                        <div key={label} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />
                          {count} {label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total</p>
                    <p className="text-base font-bold text-white">{formatBytes(totalGzip)}</p>
                  </div>
                </div>
                {analysisInfo && (
                  <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600 border-t border-zinc-800 pt-2">
                    <span className="font-mono">{analysisInfo.repoName}</span>
                    <span>{analysisInfo.analyzedFiles.length} files · {packages.filter(p=>p.found).length} packages</span>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {[...packages].filter(p=>p.found).sort((a,b)=>b.gzip-a.gzip).map(pkg=>{
                  const sev=severity(pkg.gzip); const s=SEV[sev]; const bw=Math.max((pkg.gzip/maxGzip)*100,2);
                  return (
                    <div key={pkg.name}>
                      <div className="flex items-center justify-between mb-1">
                        <a href={`https://bundlephobia.com/package/${pkg.name}`} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-violet-300 font-mono truncate flex items-center gap-1 transition-colors min-w-0">
                          {pkg.name}<ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 shrink-0"/>
                        </a>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[11px] text-zinc-300 tabular-nums">{formatBytes(pkg.gzip)}</span>
                          <span className={cn("text-[10px] border px-1 py-px rounded-full",s.badge)}>{s.label}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={cn("h-full rounded-full transition-all duration-700",s.bar)} style={{width:`${bw}%`}}/></div>
                      {pkg.dependencyCount>0 && <p className="text-[10px] text-zinc-600 mt-0.5">{pkg.dependencyCount} sub-deps · {formatBytes(pkg.size)} min</p>}
                    </div>
                  );
                })}
                {packages.filter(p=>!p.found).length>0 && (
                  <div className="pt-3 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 mb-1.5">Not on Bundlephobia:</p>
                    {packages.filter(p=>!p.found).map(p=><span key={p.name} className="inline-block text-[10px] text-zinc-600 bg-zinc-800/50 border border-zinc-700/40 rounded px-1.5 py-px mr-1 mb-1 font-mono">{p.name}</span>)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" ref={reportRef}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Priority Report</span>
                {!isDone && aiReport && <div className="flex items-center gap-1.5 text-xs text-violet-400"><span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse"/>Generating…</div>}
                {isDone && <span className="text-[11px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Complete</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!aiReport ? (
                  <div className="flex items-center gap-3 py-8 text-zinc-500 justify-center"><Loader2 className="w-4 h-4 animate-spin text-violet-400"/><span className="text-sm">GPT-4o analyzing with real size data…</span></div>
                ) : (
                  <>
                    {/* Before/After summary cards */}
                    {(() => {
                      const s = extractSummary(aiReport);
                      if (!s) return null;
                      return (
                        <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl mb-1">
                          {[
                            { label: "Current Bundle", value: s.before, cls: "text-red-400" },
                            { label: "After Fixes",    value: s.after,  cls: "text-green-400" },
                            { label: "Est. Savings",   value: s.savings, cls: "text-violet-400" },
                          ].map(({ label, value, cls }) => (
                            <div key={label} className="text-center">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">{label}</p>
                              <p className={cn("text-lg font-bold tabular-nums", cls)}>{value}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Section cards — rendered when streaming is complete */}
                    {isDone ? (
                      parseSections(aiReport).map((section, i) => {
                        const st = SECTION_STYLES[section.color];
                        return (
                          <div key={i} className={cn("border rounded-xl overflow-hidden", st.border)}>
                            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", st.dot)} />
                              <span className="text-sm font-semibold text-zinc-200">{section.heading}</span>
                            </div>
                            <div className="px-4 py-3">
                              <ReportSection text={section.body} color={section.color} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* While streaming — show raw markdown */
                      <AIOutput content={aiReport} isLoading={!isDone} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
