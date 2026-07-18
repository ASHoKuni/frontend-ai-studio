import { NextRequest, NextResponse } from "next/server";

const SOURCE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_DIRS = ["node_modules", "dist", ".next", "build", ".git", "coverage", "out", ".turbo"];
const IMPORTANT_DIRS = ["src", "app", "pages", "components", "lib", "utils", "hooks", "store"];

export interface AnalyzedFile {
  path: string;
  imports: string[];
  size: number;
}

export interface GitHubAnalysisResult {
  repoName: string;
  branch: string;
  totalFiles: number;
  analyzedFiles: AnalyzedFile[];
  packageJson: Record<string, unknown> | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

// ─── URL parser ───────────────────────────────────────────────────────────────

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(".git", "");
    const treeIdx = parts.indexOf("tree");
    const branch = treeIdx !== -1 && parts[treeIdx + 1] ? parts[treeIdx + 1] : "main";
    return { owner, repo, branch };
  } catch {
    return null;
  }
}

// ─── Import extractor ─────────────────────────────────────────────────────────

function extractImports(code: string): string[] {
  const imports = new Set<string>();
  // ES6 static imports
  const esRe = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  // require()
  const cjsRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // dynamic import()
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [esRe, cjsRe, dynRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const raw = m[1];
      if (raw.startsWith(".") || raw.startsWith("/")) continue; // relative
      const name = raw.startsWith("@")
        ? raw.split("/").slice(0, 2).join("/")
        : raw.split("/")[0];
      if (name) imports.add(name);
    }
  }
  return [...imports];
}

// ─── GitHub fetch helper ──────────────────────────────────────────────────────

async function ghFetch(url: string, token?: string) {
  const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  return res;
}

// ─── Main route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { githubUrl } = await req.json();
    const token = process.env.GITHUB_TOKEN || undefined;

    const parsed = parseGitHubUrl(githubUrl as string);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL." }, { status: 400 });
    }

    const { owner, repo, branch } = parsed;
    const repoName = `${owner}/${repo}`;
    const base = `https://api.github.com/repos/${owner}/${repo}`;

    // 1. Try to get package.json
    let packageJson: Record<string, unknown> | null = null;
    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};

    const pkgRes = await ghFetch(`${base}/contents/package.json?ref=${branch}`, token);
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json();
      const content = Buffer.from(pkgData.content as string, "base64").toString("utf-8");
      packageJson = JSON.parse(content);
      dependencies = (packageJson?.dependencies ?? {}) as Record<string, string>;
      devDependencies = (packageJson?.devDependencies ?? {}) as Record<string, string>;
    }

    // 2. Get file tree
    let allFiles: { path: string; size: number }[] = [];
    // Try main first, then master
    for (const br of [branch, "main", "master"]) {
      const treeRes = await ghFetch(`${base}/git/trees/${br}?recursive=1`, token);
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        allFiles = (treeData.tree ?? [])
          .filter((f: { type: string; path: string; size?: number }) => {
            if (f.type !== "blob") return false;
            const p = f.path;
            if (SKIP_DIRS.some((d) => p.includes(`/${d}/`) || p.startsWith(`${d}/`))) return false;
            return SOURCE_EXTS.some((ext) => p.endsWith(ext));
          })
          .map((f: { path: string; size?: number }) => ({ path: f.path, size: f.size ?? 0 }));
        break;
      }
    }

    // 3. Prioritize important files — prefer src/, app/, pages/, components/
    const prioritized = [
      ...allFiles.filter((f) => IMPORTANT_DIRS.some((d) => f.path.startsWith(`${d}/`))),
      ...allFiles.filter((f) => !IMPORTANT_DIRS.some((d) => f.path.startsWith(`${d}/`))),
    ];

    // Fetch up to 25 files (GitHub rate limit aware)
    const toFetch = prioritized.slice(0, 25);
    const analyzedFiles: AnalyzedFile[] = [];

    // Batch fetch with slight stagger to avoid rate limits
    const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
    await Promise.all(
      toFetch.map(async (file) => {
        try {
          const res = await fetch(`${rawBase}/${file.path}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) return;
          const code = await res.text();
          const imports = extractImports(code);
          if (imports.length > 0) {
            analyzedFiles.push({ path: file.path, imports, size: file.size });
          }
        } catch {
          // skip file on timeout/error
        }
      })
    );

    return NextResponse.json({
      repoName,
      branch,
      totalFiles: allFiles.length,
      analyzedFiles,
      packageJson,
      dependencies,
      devDependencies,
    } satisfies GitHubAnalysisResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
