"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-500 text-sm">
      Loading editor...
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  placeholder?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "typescript",
  height = "300px",
  placeholder,
}: CodeEditorProps) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-zinc-700"
      style={{ height }}
    >
      <MonacoEditor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          suggest: { showWords: false },
          quickSuggestions: false,
          placeholder,
          renderLineHighlight: "all",
          smoothScrolling: true,
        }}
      />
    </div>
  );
}
