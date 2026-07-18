"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { AIOutput } from "@/components/shared/AIOutput";
import { Button } from "@/components/ui/button";
import { getApiHeaders } from "@/lib/client-config";
import { Zap, Globe, FileText, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type InputMode = "url" | "paste";

interface ParsedScores {
  performance: number; accessibility: number; bestPractices: number; seo: number;
  lcp: string; cls: string; tbt: string; fcp: string; ttfb: string;
  lcpStatus: string; clsStatus: string; tbtStatus: string;
  url: string;
}

// ─── Score gauge ──────────────────────────────────────────────────────────────
function ScoreGauge({ score, label }: { score: number; label: string }) {
  const r = 26; const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 90 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const textColor = score >= 90 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[68px] h-[68px]">
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#27272a" strokeWidth="7"/>
          <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={`${fill} ${c}`}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-base font-bold", textColor)}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-zinc-500 text-center leading-tight max-w-[64px]">{label}</span>
    </div>
  );
}

// ─── CWV badge ────────────────────────────────────────────────────────────────
function CWVBadge({ label, value, status }: { label: string; value: string; status: string }) {
  const s = status === "Good" ? "border-green-800/60 bg-green-950/30 text-green-300"
          : status === "Needs Improvement" ? "border-amber-800/60 bg-amber-950/30 text-amber-300"
          : status === "Poor" ? "border-red-800/60 bg-red-950/30 text-red-300"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-500";
  const dot = status === "Good" ? "bg-green-500" : status === "Needs Improvement" ? "bg-amber-500"
            : status === "Poor" ? "bg-red-500" : "bg-zinc-600";
  return (
    <div className={cn("border rounded-xl p-3 text-center flex-1 min-w-0", s)}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dot)}/>
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      {status !== "—" && <p className="text-[10px] mt-0.5 opacity-70">{status}</p>}
    </div>
  );
}

// ─── Fix priority card ────────────────────────────────────────────────────────
interface FixItem { title: string; description: string; impact: "high" | "medium" | "low"; }
function FixCard({ item }: { item: FixItem }) {
  const s = item.impact === "high"
    ? { border: "border-red-900/40 bg-red-950/10", badge: "bg-red-900/40 text-red-300 border-red-800/50", dot: "bg-red-500", label: "High Impact" }
    : item.impact === "medium"
    ? { border: "border-amber-900/40 bg-amber-950/10", badge: "bg-amber-900/40 text-amber-300 border-amber-800/50", dot: "bg-amber-500", label: "Medium" }
    : { border: "border-emerald-900/40 bg-emerald-950/10", badge: "bg-emerald-900/40 text-emerald-300 border-emerald-800/50", dot: "bg-emerald-500", label: "Quick Win" };
  return (
    <div className={cn("border rounded-xl p-3 space-y-1.5", s.border)}>
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)}/>
        <span className="text-xs font-semibold text-zinc-200 leading-snug">{item.title}</span>
        <span className={cn("ml-auto text-[10px] border px-1.5 py-0.5 rounded-full shrink-0", s.badge)}>{s.label}</span>
      </div>
      {item.description && <p className="text-[11px] text-zinc-400 leading-relaxed pl-4">{item.description}</p>}
    </div>
  );
}

// ─── Parse AI markdown for fix items ─────────────────────────────────────────
function parseFixItems(markdown: string): FixItem[] {
  const items: FixItem[] = [];
  const lines = markdown.split("\n");
  let currentSection = "";
  for (const line of lines) {
    if (line.match(/^##.*🔴|Critical|Fix First/i)) currentSection = "high";
    else if (line.match(/^##.*🟡|High Impact|Serious/i)) currentSection = "medium";
    else if (line.match(/^##.*🟢|Quick Win|Easy/i)) currentSection = "low";
    else if (line.match(/^##/)) currentSection = "";

    if (currentSection && line.match(/^\*\*(.+?)\*\*/)) {
      const titleMatch = line.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);
      if (titleMatch) {
        items.push({
          title: titleMatch[1].trim(),
          description: titleMatch[2].trim().replace(/\*\*/g, ""),
          impact: currentSection as FixItem["impact"],
        });
      }
    }
  }
  return items.slice(0, 12);
}

interface AuditMetrics {
  url: string;
  title: string;
  screenshot: string;
  ttfb: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  domComplete: number | null;
  loadTime: number | null;
  transferSize: number | null;
  resourceCount: number;
  jsHeapUsed: number | null;
  scores?: { performance: number; accessibility: number; bestPractices: number; seo: number };
}

function scoreColor(val: number | null, thresholds: [number, number]): string {
  if (val === null) return "text-zinc-500";
  if (val <= thresholds[0]) return "text-green-400";
  if (val <= thresholds[1]) return "text-amber-400";
  return "text-red-400";
}

function scoreDot(val: number | null, thresholds: [number, number]): string {
  if (val === null) return "bg-zinc-600";
  if (val <= thresholds[0]) return "bg-green-500";
  if (val <= thresholds[1]) return "bg-amber-500";
  return "bg-red-500";
}

function fmt(ms: number | null, unit = "ms"): string {
  if (ms === null) return "—";
  if (unit === "s") return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

// ─── Parse a full Lighthouse JSON → condensed summary (<2KB) ────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ratingLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 0.9) return "Good";
  if (score >= 0.5) return "Needs Improvement";
  return "Poor";
}

function parseLighthouseJson(raw: string): { condensed: string; detected: boolean; scores?: ParsedScores } {
  try {
    const json = JSON.parse(raw);
    if (!json.lighthouseVersion && !json.categories) return { condensed: raw, detected: false };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cats = json.categories as Record<string, any> || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audits = json.audits as Record<string, any> || {};

    const scores = {
      perf:  Math.round((cats.performance?.score ?? 0) * 100),
      a11y:  Math.round((cats.accessibility?.score ?? 0) * 100),
      bp:    Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seo:   Math.round((cats.seo?.score ?? 0) * 100),
    };

    const a = (key: string) => audits[key];
    const disp = (key: string) => a(key)?.displayValue ?? "—";
    const score = (key: string) => ratingLabel(a(key)?.score ?? null);

    // Top 10 opportunities sorted by savings
    const opps = Object.values(audits)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((x: any) => x.details?.type === "opportunity" && (x.numericValue ?? 0) > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => b.numericValue - a.numericValue)
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((x: any) => `  - ${x.title}: ${x.displayValue || ""} (~${Math.round(x.numericValue)}ms savings)`)
      .join("\n");

    // Failed audits
    const failed = Object.values(audits)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((x: any) => x.score !== null && x.score < 0.5 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable")
      .slice(0, 15)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((x: any) => `  - [${Math.round((x.score ?? 0) * 100)}/100] ${x.title}: ${x.displayValue || x.description?.slice(0, 80) || ""}`)
      .join("\n");

    const condensed = `Lighthouse Report — ${json.finalUrl || json.requestedUrl || "unknown URL"}
Lighthouse v${json.lighthouseVersion ?? "?"} | ${json.fetchTime ?? ""}

## Scores
Performance: ${scores.perf}/100
Accessibility: ${scores.a11y}/100
Best Practices: ${scores.bp}/100
SEO: ${scores.seo}/100

## Core Web Vitals
LCP:  ${disp("largest-contentful-paint")}  (${score("largest-contentful-paint")})
CLS:  ${disp("cumulative-layout-shift")}   (${score("cumulative-layout-shift")})
TBT:  ${disp("total-blocking-time")}       (${score("total-blocking-time")})
FCP:  ${disp("first-contentful-paint")}    (${score("first-contentful-paint")})
TTFB: ${disp("server-response-time")}      (${score("server-response-time")})
TTI:  ${disp("interactive")}

## Top Opportunities (sorted by savings)
${opps || "  None"}

## Failed Audits (<50%)
${failed || "  None"}
`;
    return { condensed, detected: true, scores: {
      performance: scores.perf, accessibility: scores.a11y,
      bestPractices: scores.bp, seo: scores.seo,
      lcp: disp("largest-contentful-paint"),
      cls: disp("cumulative-layout-shift"),
      tbt: disp("total-blocking-time"),
      fcp: disp("first-contentful-paint"),
      ttfb: disp("server-response-time"),
      lcpStatus: score("largest-contentful-paint"),
      clsStatus: score("cumulative-layout-shift"),
      tbtStatus: score("total-blocking-time"),
      url: json.finalUrl || json.requestedUrl || "",
    }};
  } catch {
    const truncated = raw.length > 8000 ? raw.slice(0, 8000) + "\n...(truncated to 8000 chars)" : raw;
    return { condensed: truncated, detected: false };
  }
}

function buildAuditPrompt(metrics: AuditMetrics, pastedInput?: string): string {
  if (pastedInput) {
    const { condensed } = parseLighthouseJson(pastedInput);
    return condensed;
  }

  return `You are a web performance expert. Here are REAL metrics captured by a headless Playwright browser for: ${metrics.url}

## Real Measured Metrics

| Metric | Value | Threshold |
|--------|-------|-----------|
| TTFB | ${fmt(metrics.ttfb)} | Good: <200ms, Poor: >600ms |
| FCP | ${fmt(metrics.fcp, "s")} | Good: <1.8s, Poor: >3s |
| LCP | ${fmt(metrics.lcp, "s")} | Good: <2.5s, Poor: >4s |
| CLS | ${metrics.cls ?? "—"} | Good: <0.1, Poor: >0.25 |
| TBT | ${fmt(metrics.tbt)} | Good: <200ms, Poor: >600ms |
| DOM Complete | ${fmt(metrics.domComplete, "s")} | |
| Load Time | ${fmt(metrics.loadTime, "s")} | |
| Transfer Size | ${metrics.transferSize ? `${Math.round(metrics.transferSize / 1024)}KB` : "—"} | |
| Resources | ${metrics.resourceCount} requests | |
| JS Heap | ${metrics.jsHeapUsed ? `${metrics.jsHeapUsed}MB` : "—"} | |

## Analysis Request

Based on these REAL measurements, provide:

## 📊 Performance Score
Estimate Performance / Accessibility / Best Practices / SEO scores (0-100) based on the metrics.

## 🔴 Critical Issues (Must Fix)
Issues causing the biggest negative impact with specific fixes.

## ⚡ Core Web Vitals Analysis
- **LCP** (${fmt(metrics.lcp, "s")}): Analysis + how to improve
- **CLS** (${metrics.cls ?? "not measured"}): Analysis + how to improve  
- **TBT** (${fmt(metrics.tbt)}): Analysis + how to improve (proxy for FID/INP)

## 🚀 Quick Wins
5 highest-impact improvements ordered by effort vs reward.

## 🗺️ Implementation Roadmap
Ordered list of fixes with estimated improvement per change.

Be specific. Reference the actual measured values above.`;
}

export function LighthouseAuditPage() {
  const [mode, setMode] = useState<InputMode>("url");
  const [siteUrl, setSiteUrl] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [aiReport, setAiReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [parsedScores, setParsedScores] = useState<ParsedScores | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const isDone = !!aiReport && !isGenerating;

  const streamReport = async (prompt: string) => {
    setIsGenerating(true);
    setAiReport("");
    const res = await fetch("/api/tools/lighthouse", {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({ input: prompt }),
    });
    if (!res.ok) {
      const e = await res.json();
      setAiReport(`**Error:** ${e.error}`);
      setIsGenerating(false);
      return;
    }
    const reader = res.body?.getReader();
    const dec = new TextDecoder();
    if (!reader) { setIsGenerating(false); return; }
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      setAiReport(acc);
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    setIsGenerating(false);
  };

  const handleURLAudit = async () => {
    if (!siteUrl.trim() || auditLoading) return;
    setAuditLoading(true); setAuditError(""); setMetrics(null); setAiReport("");
    try {
      const res = await fetch("/api/lighthouse/audit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAuditError(data.error ?? "Audit failed."); return; }
      setMetrics(data as AuditMetrics);
      await streamReport(buildAuditPrompt(data as AuditMetrics));
    } catch { setAuditError("Network error. Please try again."); }
    finally { setAuditLoading(false); }
  };

  const handlePasteAudit = async () => {
    if (!pasteInput.trim() || isGenerating) return;
    setMetrics(null); setAiReport(""); setParsedScores(null);
    const { condensed, detected, scores } = parseLighthouseJson(pasteInput);
    if (scores) setParsedScores(scores);
    await streamReport(detected ? condensed : buildAuditPrompt({ url: "pasted data" } as AuditMetrics, condensed));
  };

  const handleReset = () => {
    setMetrics(null); setAiReport(""); setAuditError(""); setSiteUrl(""); setPasteInput(""); setParsedScores(null);
  };

  const METRIC_ROWS: { label: string; value: number | null; thresholds: [number, number]; unit?: string }[] = metrics ? [
    { label: "TTFB",        value: metrics.ttfb,       thresholds: [200, 600] },
    { label: "FCP",         value: metrics.fcp,        thresholds: [1800, 3000], unit: "s" },
    { label: "LCP",         value: metrics.lcp,        thresholds: [2500, 4000], unit: "s" },
    { label: "CLS × 1000", value: metrics.cls != null ? Math.round(metrics.cls * 1000) : null, thresholds: [100, 250] },
    { label: "TBT",         value: metrics.tbt,        thresholds: [200, 600] },
    { label: "DOM Complete",value: metrics.domComplete, thresholds: [3500, 7000], unit: "s" },
    { label: "Load Time",   value: metrics.loadTime,   thresholds: [3000, 6000], unit: "s" },
  ] : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-lg shrink-0">🔦</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Lighthouse Analyzer</h2>
              <span className="text-[10px] bg-green-900/50 text-green-300 border border-green-800 px-2 py-0.5 rounded-full">Real Browser</span>
            </div>
            <p className="text-xs text-zinc-500">Live Playwright audit — real Core Web Vitals + AI recommendations</p>
          </div>
          {(metrics || aiReport) && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-zinc-500 hover:text-zinc-300 h-8 gap-1 text-xs">
              New Audit
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Input / Metrics */}
        <div className="w-[400px] shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">

          {/* Input section — always visible unless results loaded */}
          {!metrics && !auditLoading && (
            <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                <button onClick={() => setMode("url")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all", mode === "url" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
                  <Globe className="w-3.5 h-3.5" />Live URL
                </button>
                <button onClick={() => setMode("paste")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all", mode === "paste" ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>
                  <FileText className="w-3.5 h-3.5" />Paste Report
                </button>
              </div>

              {/* URL input */}
              {mode === "url" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400">Website URL</label>
                    <input
                      value={siteUrl}
                      onChange={e => { setSiteUrl(e.target.value); setAuditError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleURLAudit()}
                      placeholder="https://yoursite.com"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-700 font-mono transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Playwright opens a real Chromium browser, navigates to the URL, and measures actual LCP, CLS, TBT, TTFB + captures a screenshot.
                  </p>
                  <Button onClick={handleURLAudit} disabled={!siteUrl.trim()} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-900/30">
                    <Zap className="w-4 h-4 mr-1.5" />Run Real Audit
                  </Button>
                </div>
              )}

              {/* Paste input */}
              {mode === "paste" && (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-400">Paste Lighthouse JSON or performance data</label>
                      {pasteInput.length > 0 && (
                        <span className={cn("text-[10px] tabular-nums", pasteInput.length > 50000 ? "text-amber-400" : "text-zinc-600")}>
                          {pasteInput.length > 1000 ? `${(pasteInput.length / 1000).toFixed(1)}KB` : `${pasteInput.length}B`}
                          {pasteInput.length > 50000 ? " — will be parsed & condensed" : ""}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={pasteInput}
                      onChange={e => setPasteInput(e.target.value)}
                      placeholder={`Paste your Lighthouse report JSON, or describe scores like:\n\nPerformance: 45\nLCP: 4.2s\nCLS: 0.28\nTBT: 620ms\nFCP: 2.8s`}
                      className="flex-1 min-h-[200px] bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-700 font-mono leading-relaxed transition-colors"
                    />
                  </div>
                  {pasteInput.length > 50000 && (
                    <div className="text-[11px] text-amber-400/80 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2 leading-relaxed">
                      Large Lighthouse JSON detected — will extract key metrics before sending to GPT-4o (avoids token limit).
                    </div>
                  )}
                  <Button onClick={handlePasteAudit} disabled={!pasteInput.trim() || isGenerating} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-900/30">
                    <Zap className="w-4 h-4 mr-1.5" />{isGenerating ? "Analyzing…" : "Analyze Report"}
                  </Button>
                </div>
              )}

              {auditError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{auditError}</span>
                </div>
              )}
            </div>
          )}

          {/* Loading steps */}
          {auditLoading && (
            <div className="flex-1 flex flex-col justify-center p-6 space-y-4">
              {[
                { label: "Launching headless Chromium", done: true },
                { label: `Navigating to ${siteUrl || "URL"}`, done: true },
                { label: "Waiting for load + Core Web Vitals", done: false },
                { label: "Capturing screenshot", done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.done
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    : <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />}
                  <span className={cn("text-sm", step.done ? "text-zinc-500" : "text-white font-medium")}>{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Metrics panel (after audit) */}
          {metrics && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Screenshot thumbnail */}
              {metrics.screenshot && (
                <div className="relative shrink-0 border-b border-zinc-800">
                  <Image src={metrics.screenshot} alt="Site screenshot" width={400} height={225}
                    className="w-full h-auto max-h-44 object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                    <span className="text-xs text-zinc-300 font-medium truncate">{metrics.title}</span>
                    <a href={metrics.url} target="_blank" rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 shrink-0 ml-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
              {/* Metrics table */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Real Measurements</p>
                {METRIC_ROWS.map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", scoreDot(row.value, row.thresholds))} />
                      <span className="text-xs text-zinc-400">{row.label}</span>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums", scoreColor(row.value, row.thresholds))}>
                      {row.unit === "s" ? fmt(row.value, "s") : fmt(row.value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" /><span className="text-xs text-zinc-400">Resources</span></div>
                  <span className="text-sm font-semibold text-zinc-300">{metrics.resourceCount}</span>
                </div>
                {metrics.transferSize != null && (
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" /><span className="text-xs text-zinc-400">Transfer Size</span></div>
                    <span className="text-sm font-semibold text-zinc-300">{Math.round(metrics.transferSize / 1024)}KB</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Visual report */}
        <div className="flex-1 flex flex-col overflow-hidden" ref={reportRef}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Developer Report</span>
            {isGenerating && <div className="flex items-center gap-1.5 text-xs text-violet-400"><span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />Generating…</div>}
            {isDone && <span className="text-[11px] text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Complete</span>}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Empty state */}
            {!aiReport && !isGenerating && !parsedScores && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl opacity-40">🔦</div>
                <div>
                  <p className="text-zinc-500 text-sm font-medium">No audit yet</p>
                  <p className="text-zinc-600 text-xs mt-1 max-w-sm leading-relaxed">Enter a URL for a <strong className="text-zinc-500">real browser audit</strong> — Playwright captures actual LCP, CLS, TBT + screenshot. Or paste a Lighthouse report.</p>
                </div>
              </div>
            )}

            {/* Visual charts section */}
            {(parsedScores || metrics) && (
              <div className="p-4 space-y-4 border-b border-zinc-800">
                {/* Score gauges — from Lighthouse JSON (paste) OR PageSpeed Insights (live URL) */}
                {(parsedScores || metrics?.scores) && (
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Lighthouse Scores</p>
                    <div className="flex justify-around">
                      {(() => {
                        const s = parsedScores ?? metrics!.scores!;
                        return <>
                          <ScoreGauge score={s.performance} label="Performance" />
                          <ScoreGauge score={s.accessibility} label="Accessibility" />
                          <ScoreGauge score={s.bestPractices} label="Best Practices" />
                          <ScoreGauge score={s.seo} label="SEO" />
                        </>;
                      })()}
                    </div>
                  </div>
                )}

                {/* Core Web Vitals */}
                <div>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Core Web Vitals</p>
                  <div className="flex gap-2">
                    {parsedScores ? (
                      <>
                        <CWVBadge label="LCP" value={parsedScores.lcp} status={parsedScores.lcpStatus} />
                        <CWVBadge label="CLS" value={parsedScores.cls} status={parsedScores.clsStatus} />
                        <CWVBadge label="TBT" value={parsedScores.tbt} status={parsedScores.tbtStatus} />
                        <CWVBadge label="FCP" value={parsedScores.fcp} status="—" />
                      </>
                    ) : metrics ? (
                      <>
                        <CWVBadge label="LCP"  value={metrics.lcp  ? `${(metrics.lcp/1000).toFixed(2)}s`  : "—"} status={metrics.lcp  ? (metrics.lcp<=2500?"Good":metrics.lcp<=4000?"Needs Improvement":"Poor") : "—"} />
                        <CWVBadge label="CLS"  value={metrics.cls  != null ? metrics.cls.toFixed(3)       : "—"} status={metrics.cls  != null ? (metrics.cls<=0.1?"Good":metrics.cls<=0.25?"Needs Improvement":"Poor") : "—"} />
                        <CWVBadge label="TBT"  value={metrics.tbt  ? `${metrics.tbt}ms`                   : "—"} status={metrics.tbt  ? (metrics.tbt<=200?"Good":metrics.tbt<=600?"Needs Improvement":"Poor") : "—"} />
                        <CWVBadge label="TTFB" value={metrics.ttfb ? `${metrics.ttfb}ms`                  : "—"} status={metrics.ttfb ? (metrics.ttfb<=200?"Good":metrics.ttfb<=600?"Needs Improvement":"Poor") : "—"} />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* AI streaming while generating */}
            {isGenerating && !aiReport && (
              <div className="flex items-center gap-3 p-6 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
                <span className="text-sm">GPT-4o analyzing and generating fix plan…</span>
              </div>
            )}

            {/* Fix cards (after done) */}
            {aiReport && isDone && (() => {
              const fixes = parseFixItems(aiReport);
              return fixes.length > 0 ? (
                <div className="p-4 space-y-3">
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Priority Fix Plan</p>
                  {fixes.map((fix, i) => <FixCard key={i} item={fix} />)}
                  {/* Full AI report collapsed below */}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors select-none py-2">
                      View full AI analysis ▾
                    </summary>
                    <div className="mt-2">
                      <AIOutput content={aiReport} isLoading={false} />
                    </div>
                  </details>
                </div>
              ) : (
                <AIOutput content={aiReport} isLoading={false} />
              );
            })()}

            {/* Streaming output */}
            {aiReport && !isDone && (
              <AIOutput content={aiReport} isLoading={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
