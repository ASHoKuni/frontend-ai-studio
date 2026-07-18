import { NextRequest, NextResponse } from "next/server";
import { transform } from "esbuild";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Strip react / react-dom imports — these are provided as globals via CDN in the iframe.
    // esbuild's transform() has no "external" option, so without stripping it emits
    // require("react") calls which break in the browser.
    const stripped = (code as string)
      .replace(
        /^import\s+(?:[^'"]*\s+from\s+)?['"](?:react|react-dom(?:\/client)?)['"];?\s*\n?/gm,
        ""
      )
      // Also strip type-only imports
      .replace(
        /^import\s+type\s+.*?\s+from\s+['"](?:react|react-dom(?:\/client)?)['"];?\s*\n?/gm,
        ""
      );

    const result = await transform(stripped, {
      loader: "tsx",
      target: "es2017",
      format: "iife",
      globalName: "__Module",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      define: { "process.env.NODE_ENV": '"development"' },
      logLevel: "silent",
    });

    return NextResponse.json({ js: result.code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Transpile failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const runtime = "nodejs";
