import Link from "next/link";
import { TOOLS } from "@/lib/tools";

export default function Home() {
  return (
    <div className="min-h-full bg-zinc-950 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.15),transparent)]" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-violet-950/50 border border-violet-800/50 rounded-full px-4 py-1.5 text-xs text-violet-300 mb-2">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            Powered by OpenAI GPT-4o
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight">
            Frontend AI{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              Studio
            </span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            9 AI-powered tools for frontend developers. Review code, generate
            components, audit accessibility, analyze performance — all in one place.
          </p>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/tools/screenshot"
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-violet-900/40"
            >
              🚀 Start Analyzing
            </Link>
            <Link
              href="/tools/component"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold px-6 py-3 rounded-xl transition-all duration-200 border border-zinc-700"
            >
              ⚛️ Generate Component
            </Link>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="px-8 pb-16 max-w-6xl mx-auto w-full">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600 text-center mb-8">
          9 Tools Available
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="group bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-violet-800/50 rounded-2xl p-5 transition-all duration-200"
            >
              <span className="text-3xl block mb-3">{tool.icon}</span>
              <h3 className="font-semibold text-sm text-white group-hover:text-violet-300 transition-colors">
                {tool.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                {tool.description}
              </p>
              {tool.badge && (
                <span className="inline-block mt-2 text-[10px] bg-violet-900/40 text-violet-400 border border-violet-800/50 px-2 py-0.5 rounded-full">
                  {tool.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
