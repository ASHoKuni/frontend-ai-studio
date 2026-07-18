import { NextRequest, NextResponse } from "next/server";

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("figma.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const typeIdx = parts.findIndex((p) => p === "design" || p === "file");
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
    const fileKey = parts[typeIdx + 1];
    const nodeId =
      u.searchParams.get("node-id") ?? u.searchParams.get("node_id");
    if (!nodeId) return null;
    // Figma uses "0-1" format in URLs but "0:1" in the API
    return { fileKey, nodeId: nodeId.replace(/-/g, ":") };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { figmaUrl } = await req.json();

    const token =
      req.headers.get("x-figma-token") ??
      process.env.FIGMA_ACCESS_TOKEN ??
      "";
    if (!token || token === "your_figma_personal_access_token_here") {
      return NextResponse.json(
        { error: "FIGMA_ACCESS_TOKEN not set in .env.local" },
        { status: 400 }
      );
    }

    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Figma URL. Make sure it includes a ?node-id parameter." },
        { status: 400 }
      );
    }

    const { fileKey, nodeId } = parsed;

    // Call Figma Images API
    const figmaRes = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`,
      { headers: { "X-Figma-Token": token } }
    );

    if (!figmaRes.ok) {
      const err = await figmaRes.text();
      return NextResponse.json(
        { error: `Figma API error: ${figmaRes.status} — ${err}` },
        { status: figmaRes.status }
      );
    }

    const figmaData = await figmaRes.json();
    const imageUrl = figmaData.images?.[nodeId];

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Figma returned no image. Check the node-id in the URL." },
        { status: 400 }
      );
    }

    // Download the image and convert to base64 so we can pass to OpenAI Vision
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: "Failed to download Figma image." },
        { status: 500 }
      );
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") ?? "image/png";

    return NextResponse.json({
      imageBase64: `data:${mimeType};base64,${base64}`,
      imageUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
