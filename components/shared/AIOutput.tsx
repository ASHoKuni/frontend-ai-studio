"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface AIOutputProps {
  content: string;
  isLoading?: boolean;
}

export function AIOutput({ content, isLoading }: AIOutputProps) {
  if (isLoading && !content) {
    return (
      <div className="flex items-center gap-3 p-6 text-zinc-400">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" />
        </div>
        <span className="text-sm">Analyzing with GPT-4o...</span>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="prose prose-invert prose-zinc max-w-none p-6 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-white mt-6 mb-2 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-zinc-200 mt-4 mb-1">{children}</h3>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={`${className} text-xs`}>{children}</code>
              );
            }
            return (
              <code className="bg-zinc-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-x-auto my-3">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1 my-2 pl-4">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-zinc-300 text-sm">{children}</li>
          ),
          p: ({ children }) => (
            <p className="text-zinc-300 my-2 text-sm leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
