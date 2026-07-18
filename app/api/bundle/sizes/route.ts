import { NextRequest, NextResponse } from "next/server";

export interface PackageSize {
  name: string;
  version: string;
  size: number;      // raw bytes
  gzip: number;      // gzipped bytes
  dependencyCount: number;
  found: boolean;
}

function parsePackageNames(input: string): string[] {
  const packages: string[] = [];

  // Try as package.json first
  try {
    const json = JSON.parse(input);
    const deps = {
      ...(json.dependencies ?? {}),
      ...(json.devDependencies ?? {}),
    };
    return Object.keys(deps).filter((k) => !k.startsWith("@types/"));
  } catch {
    // not JSON — parse import/require statements
  }

  // ES6 imports: import X from 'pkg' / import { X } from 'pkg'
  const importRe = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  // CommonJS: require('pkg')
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  const extract = (raw: string) => {
    if (raw.startsWith(".") || raw.startsWith("/")) return;
    if (raw.startsWith("@")) {
      const parts = raw.split("/");
      if (parts.length >= 2) packages.push(`${parts[0]}/${parts[1]}`);
    } else {
      packages.push(raw.split("/")[0]);
    }
  };

  let m: RegExpExecArray | null;
  while ((m = importRe.exec(input)) !== null) extract(m[1]);
  while ((m = requireRe.exec(input)) !== null) extract(m[1]);

  // Also scan lines like: "lodash": "^4.17.21",
  const depLineRe = /["']([^"']+)["']\s*:\s*["'][^"']*["']/g;
  while ((m = depLineRe.exec(input)) !== null) {
    const name = m[1];
    if (!name.includes("/") || name.startsWith("@")) {
      if (name.startsWith("@")) {
        const parts = name.split("/");
        if (parts.length >= 2) packages.push(`${parts[0]}/${parts[1]}`);
      } else if (!name.includes(":")) {
        packages.push(name.split("/")[0]);
      }
    }
  }

  return [...new Set(packages)].filter(Boolean);
}

async function fetchPackageSize(name: string): Promise<PackageSize> {
  try {
    const res = await fetch(
      `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}`,
      {
        headers: {
          "User-Agent": "Frontend-AI-Studio/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return { name, version: "?", size: 0, gzip: 0, dependencyCount: 0, found: false };
    }

    const data = await res.json();
    return {
      name,
      version: data.version ?? "?",
      size: data.size ?? 0,
      gzip: data.gzip ?? 0,
      dependencyCount: data.dependencyCount ?? 0,
      found: true,
    };
  } catch {
    return { name, version: "?", size: 0, gzip: 0, dependencyCount: 0, found: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Accept either a direct names array (from pipeline) or a raw input string (from paste UI)
    let names: string[];
    if (Array.isArray(body.names)) {
      names = (body.names as string[])
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith("@types/") && !n.startsWith(".") && !n.startsWith("/"));
    } else if (body.input?.trim()) {
      names = parsePackageNames(body.input as string);
    } else {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    if (names.length === 0) {
      return NextResponse.json(
        { error: "No package names found. Paste a package.json or import statements." },
        { status: 400 }
      );
    }

    // Fetch all in parallel (max 25)
    const results = await Promise.all(
      names.slice(0, 25).map((name) => fetchPackageSize(name))
    );

    return NextResponse.json({ packages: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
