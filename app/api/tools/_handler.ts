import OpenAI from "openai";
import { PROMPTS } from "@/lib/prompts";
import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type ToolId =
  | "screenshot"
  | "component"
  | "code-review"
  | "architecture"
  | "accessibility"
  | "performance"
  | "bundle"
  | "lighthouse";

export function createToolHandler(toolId: ToolId) {
  return async function POST(req: NextRequest) {
    try {
      const { input, imageBase64 } = await req.json();

      // Prefer key from request header (UI settings), fall back to env var
      const apiKey =
        req.headers.get("x-openai-key") ?? process.env.OPENAI_API_KEY ?? "";
      if (!apiKey) {
        return NextResponse.json(
          { error: "OpenAI API key not configured. Click \"API Keys\" in the sidebar." },
          { status: 401 }
        );
      }

      const promptMap: Record<ToolId, string> = {
        screenshot: PROMPTS.screenshot,
        component: PROMPTS.component,
        "code-review": PROMPTS.codeReview,
        architecture: PROMPTS.architecture,
        accessibility: PROMPTS.accessibility,
        performance: PROMPTS.performance,
        bundle: PROMPTS.bundle,
        lighthouse: PROMPTS.lighthouse,
      };

      const systemPrompt = promptMap[toolId];

      // Build messages based on tool type
      const isVision = toolId === "screenshot" && imageBase64;
      const isTextAppend = toolId === "component" || toolId === "lighthouse";

      let messages: ChatCompletionMessageParam[];

      if (isVision) {
        messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageBase64 as string, detail: "high" },
              },
            ],
          },
        ];
      } else if (isTextAppend) {
        messages = [
          {
            role: "user",
            content: systemPrompt + (input || ""),
          },
        ];
      } else {
        messages = [
          {
            role: "user",
            content: `${systemPrompt}\n\n\`\`\`\n${input || ""}\n\`\`\``,
          },
        ];
      }

      const client = new OpenAI({ apiKey });
      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.3,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
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
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error(`[${toolId}] Error:`, message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
