import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// Fallback: Microlink API (free, no key needed, works on Vercel)
async function screenshotViaApi(url: string) {
  const encoded = encodeURIComponent(url);
  const res = await fetch(
    `https://api.microlink.io/?url=${encoded}&screenshot=true&meta=false&screenshot.viewport.width=1440&screenshot.viewport.height=900`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) throw new Error("Microlink API failed");
  const data = await res.json();
  const screenshotUrl: string = data?.data?.screenshot?.url;
  if (!screenshotUrl) throw new Error("No screenshot URL returned");
  // Download and convert to base64
  const imgRes = await fetch(screenshotUrl, { signal: AbortSignal.timeout(15000) });
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mime = imgRes.headers.get("content-type") ?? "image/png";
  return { imageBase64: `data:${mime};base64,${base64}`, url, metrics: {} };
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const pw = await import("playwright").catch(() => null);
  if (!pw) {
    // Vercel / serverless — use Microlink screenshot API as fallback
    try {
      const result = await screenshotViaApi(parsedUrl.toString());
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Screenshot failed";
      return NextResponse.json({ error: `Screenshot API error: ${msg}` }, { status: 502 });
    }
  }

  const browser = await pw.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  }).catch(() => null);

  if (!browser) return NextResponse.json({ error: "Browser launch failed" }, { status: 503 });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(parsedUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    // Wait a bit for JS-driven UIs to paint
    await page.waitForTimeout(2000);

    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    // Collect basic perf metrics while we're here
    const metrics = await page.evaluate(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          domComplete: nav ? Math.round(nav.domComplete - nav.startTime) : null,
          loadTime: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
          title: document.title,
        };
      } catch {
        return {};
      }
    });

    const base64 = Buffer.from(screenshotBuffer).toString("base64");

    return NextResponse.json({
      imageBase64: `data:image/png;base64,${base64}`,
      url: parsedUrl.toString(),
      metrics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Screenshot failed";
    return NextResponse.json({ error: `Playwright error: ${msg}` }, { status: 500 });
  } finally {
    await browser.close();
  }
}

export const runtime = "nodejs";
