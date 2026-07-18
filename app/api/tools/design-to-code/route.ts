import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const DESIGN_TO_CODE_PROMPT = `You are a pixel-perfect UI engineer. Recreate this screenshot as a React + Tailwind component that looks IDENTICAL to the original.

VISUAL FIDELITY — TOP PRIORITY:
- Colors: Extract exact hex colors from the screenshot and use Tailwind arbitrary values: bg-[#1a1a2e], text-[#4f46e5], border-[#e2e8f0]
- Background: Match exact background color (dark/light/gradient)
- Buttons: Match exact button colors, border-radius, padding, font weight
- Typography: Match font sizes (text-xs/sm/base/lg/xl), font weights, letter spacing
- Spacing: Match padding and margins as closely as possible (p-2/p-4/p-6, gap-2/gap-4)
- Borders: Match border widths, colors, radius (rounded-sm/md/lg/xl/full)
- Shadows: Add box shadows matching the screenshot (shadow-sm/md/lg or shadow-[...])
- Icons: Use emoji or Unicode symbols to approximate icons shown
- Dark mode: If the screenshot shows a dark UI, use dark backgrounds (bg-gray-900, bg-zinc-800, etc.)

DATA — Replace only actual user data, keep all UI labels/text:
- Real names → "John Doe" / real emails → "user@example.com" / real IDs → "ID-001"
- KEEP: button labels, column headers, navigation items, form labels, status badges (these are UI, not data)

DEFENSIVE CODING — REQUIRED:
- All arrays must be defined with data INSIDE the component: const items = [{id:1, label:'Item A'},{id:2,label:'Item B'}]
- NEVER call .map() on undefined — always initialize with array default
- useState for arrays: useState([item1, item2]) — NEVER useState()
- Self-contained: no external props needed to render

REQUIREMENTS:
1. Single complete self-contained React functional component
2. TypeScript
3. Tailwind CSS — use arbitrary hex values for exact color matching
4. Named export
5. All sample data hardcoded with realistic placeholder values

OUTPUT — return ONLY a tsx code block:
\`\`\`tsx
import React from 'react';

export function ComponentName() {
  return (
    // pixel-perfect JSX here
  );
}
\`\`\`

No text outside the code block.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    const apiKey =
      req.headers.get("x-openai-key") ?? process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Click \"API Keys\" in the sidebar." },
        { status: 401 }
      );
    }

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: DESIGN_TO_CODE_PROMPT,
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
                detail: "high",
              },
            },
          ],
        },
      ],
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
    console.error("[design-to-code]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";

