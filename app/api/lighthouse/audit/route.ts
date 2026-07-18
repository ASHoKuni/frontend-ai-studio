import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface WebVitals {
  url: string;
  title: string;
  ttfb: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  domInteractive: number | null;
  domComplete: number | null;
  loadTime: number | null;
  transferSize: number | null;
  resourceCount: number;
  jsHeapUsed: number | null;
  screenshot: string;
  scores?: { performance: number; accessibility: number; bestPractices: number; seo: number };
}

// ── PageSpeed Insights fallback (works on Vercel, same engine as Lighthouse) ──
async function auditViaPageSpeed(url: string): Promise<WebVitals> {
  const encoded = encodeURIComponent(url);
  const psiUrl =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encoded}&strategy=desktop` +
    `&category=performance&category=accessibility&category=best-practices&category=seo`;

  const res = await fetch(psiUrl, { signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw new Error(`PageSpeed Insights returned ${res.status}`);

  const data = await res.json();
  const lhr = data.lighthouseResult || {};
  const audits = lhr.audits || {};
  const cats = lhr.categories || {};

  const ms = (key: string): number | null => {
    const v = audits[key]?.numericValue;
    return v != null ? Math.round(v) : null;
  };

  // PSI includes a compressed screenshot
  const screenshot: string =
    audits["final-screenshot"]?.details?.data ?? "";

  return {
    url,
    title: lhr.finalUrl || new URL(url).hostname,
    ttfb: ms("server-response-time"),
    fcp: ms("first-contentful-paint"),
    lcp: ms("largest-contentful-paint"),
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tbt: ms("total-blocking-time"),
    domInteractive: null,
    domComplete: null,
    loadTime: ms("interactive"),
    transferSize: ms("total-byte-weight"),
    resourceCount: 0,
    jsHeapUsed: null,
    screenshot,
    scores: {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
    },
  };
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const pw = await import("playwright").catch(() => null);
  if (!pw) {
    // Vercel / serverless — use Google PageSpeed Insights (same Lighthouse engine)
    try {
      const result = await auditViaPageSpeed(parsedUrl.toString());
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Audit failed";
      return NextResponse.json({ error: `PageSpeed Insights error: ${msg}` }, { status: 502 });
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
    });
    const page = await context.newPage();

    // Inject Web Vitals observer BEFORE navigation
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__vitals__ = {};

      // LCP observer
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (last) (window as any).__vitals__.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch { /* not supported */ }

      // CLS observer
      let clsVal = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!e.hadRecentInput) clsVal += e.value;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__vitals__.cls = clsVal;
        }).observe({ type: "layout-shift", buffered: true });
      } catch { /* not supported */ }

      // TBT approximation via long tasks
      let tbt = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            tbt += Math.max(entry.duration - 50, 0);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__vitals__.tbt = tbt;
        }).observe({ type: "longtask", buffered: true });
      } catch { /* not supported */ }
    });

    const startTime = Date.now();

    await page.goto(parsedUrl.toString(), {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Extra wait for LCP to stabilize
    await page.waitForTimeout(2500);

    // Collect all metrics
    const vitals = await page.evaluate((): Partial<WebVitals> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = (window as any).__vitals__ || {};
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        const resources = performance.getEntriesByType("resource");

        return {
          title: document.title,
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          lcp: v.lcp ? Math.round(v.lcp) : null,
          cls: v.cls != null ? Math.round(v.cls * 1000) / 1000 : null,
          tbt: v.tbt ? Math.round(v.tbt) : null,
          domInteractive: nav ? Math.round(nav.domInteractive - nav.startTime) : null,
          domComplete: nav ? Math.round(nav.domComplete - nav.startTime) : null,
          loadTime: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
          transferSize: nav ? nav.transferSize : null,
          resourceCount: resources.length,
          jsHeapUsed: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
            ? Math.round(((performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1024 / 1024)
            : null,
        };
      } catch {
        return {};
      }
    });

    const screenshot = await page.screenshot({ type: "png", fullPage: false });

    const result: WebVitals = {
      url: parsedUrl.toString(),
      title: vitals.title ?? parsedUrl.hostname,
      ttfb: vitals.ttfb ?? null,
      fcp: vitals.fcp ?? null,
      lcp: vitals.lcp ?? null,
      cls: vitals.cls ?? null,
      tbt: vitals.tbt ?? null,
      domInteractive: vitals.domInteractive ?? null,
      domComplete: vitals.domComplete ?? null,
      loadTime: vitals.loadTime ?? (Date.now() - startTime),
      transferSize: vitals.transferSize ?? null,
      resourceCount: vitals.resourceCount ?? 0,
      jsHeapUsed: vitals.jsHeapUsed ?? null,
      screenshot: `data:image/png;base64,${Buffer.from(screenshot).toString("base64")}`,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Audit failed";
    return NextResponse.json({ error: `Playwright error: ${msg}` }, { status: 500 });
  } finally {
    await browser.close();
  }
}

export const runtime = "nodejs";
