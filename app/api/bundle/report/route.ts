import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { PackageSize } from "@/app/api/bundle/sizes/route";
import type { AnalyzedFile } from "@/app/api/github/analyze/route";

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function buildReportPrompt(
  packages: PackageSize[],
  analyzedFiles: AnalyzedFile[],
  repoName: string,
  totalFiles: number
): string {
  const found = packages.filter((p) => p.found).sort((a, b) => b.gzip - a.gzip);
  const totalBefore = found.reduce((s, p) => s + p.gzip, 0);

  const pkgTable = found
    .map((p) => `| ${p.name}@${p.version} | ${formatBytes(p.gzip)} | ${p.dependencyCount} deps |`)
    .join("\n");

  // Build a map: package → which files import it
  const pkgToFiles: Record<string, string[]> = {};
  for (const file of analyzedFiles) {
    for (const imp of file.imports) {
      if (!pkgToFiles[imp]) pkgToFiles[imp] = [];
      pkgToFiles[imp].push(file.path);
    }
  }

  const importMap = Object.entries(pkgToFiles)
    .map(([pkg, files]) => `- \`${pkg}\` → used in: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ` (+${files.length - 5} more)` : ""}`)
    .join("\n");

  // Detect non-tree-shakeable patterns
  const badImports: string[] = [];
  for (const file of analyzedFiles) {
    const content = file.imports.join(", ");
    if (file.imports.includes("lodash")) {
      badImports.push(`\`${file.path}\`: \`import _ from 'lodash'\` (barrel import — kills tree-shaking)`);
    }
    if (file.imports.includes("moment")) {
      badImports.push(`\`${file.path}\`: imports \`moment\` (67KB gzip — should use date-fns/dayjs)`);
    }
    if (content.includes("@fortawesome/free-solid-svg-icons")) {
      badImports.push(`\`${file.path}\`: imports entire FontAwesome icon set (400KB) — use individual icon imports`);
    }
  }

  return `You are a senior JavaScript performance engineer auditing the bundle of **${repoName}**.

## Real Package Sizes (from Bundlephobia)

| Package | Gzip Size | Dependencies |
|---------|-----------|--------------|
${pkgTable}

**Total current bundle weight: ${formatBytes(totalBefore)} gzipped**
**Files in repo: ${totalFiles} | Files analyzed: ${analyzedFiles.length}**

## Import Usage Map (which files import which packages)
${importMap || "No import data available."}

${badImports.length > 0 ? `## ⚠️ Problematic Import Patterns Detected\n${badImports.join("\n")}` : ""}

---

Generate a professional, actionable bundle audit report. Use this EXACT structure:

## 📊 Bundle Summary

Create a before/after table:
| | Before | After (Projected) | Savings |
|---|---|---|---|
| Bundle Size | ${formatBytes(totalBefore)} | (calculate) | (calculate %) |

Estimate the "After" size assuming all your recommendations are applied.

## 🔴 Critical Issues — Fix These First

For each package over 50KB, give:
- **Package**: name + current size
- **Problem**: why it's an issue  
- **File(s)**: which files import it (from the map above)
- **Fix**: exact replacement with its size (e.g., "Replace with date-fns — 8KB gzip, saves 59KB")
- **Code**: show the exact import change (before → after)

## 🟡 High Impact Improvements

Issues saving 10–50KB each. Same format as above.

## 🟢 Quick Wins

Small fixes under 10KB savings but easy to implement.

## 📁 File-by-File Priority List

Sorted by impact. For each file with issues:
\`\`\`
src/App.tsx         → 3 issues: [moment import, lodash barrel, antd full import]  Est. savings: -180KB
src/utils/date.ts   → 1 issue:  [moment import] Est. savings: -67KB
\`\`\`

## 🗺️ Implementation Roadmap

Step-by-step ordered plan:
1. [Highest impact first] — Est. time, Est. savings
2. ...

## 📈 Expected Outcome

Final before/after summary with percentage improvement.

Be specific. Reference exact file paths. Use actual KB numbers from the data above.`;
}

export async function POST(req: NextRequest) {
  try {
    const { packages, analyzedFiles, repoName, totalFiles } = await req.json();

    const apiKey = req.headers.get("x-openai-key") ?? process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Click "API Keys" in the sidebar.' },
        { status: 401 }
      );
    }

    const prompt = buildReportPrompt(
      packages as PackageSize[],
      (analyzedFiles ?? []) as AnalyzedFile[],
      (repoName as string) ?? "project",
      (totalFiles as number) ?? 0
    );

    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 4096,
      temperature: 0.2,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
