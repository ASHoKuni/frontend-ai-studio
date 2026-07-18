"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface FileUploadProps {
  onFileSelect: (file: File, base64: string) => void;
  accept?: Record<string, string[]>;
}

export function FileUpload({ onFileSelect, accept }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        onFileSelect(file, base64);
      };
      reader.readAsDataURL(file);
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ?? { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
    maxFiles: 1,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-violet-500 bg-violet-950/30"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">{isDragActive ? "📥" : "🖼️"}</span>
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {isDragActive ? "Drop it here!" : "Drop a screenshot or click to upload"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">PNG, JPG, WEBP up to 20MB</p>
          </div>
        </div>
      </div>

      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
          <Image
            src={preview}
            alt="Uploaded screenshot"
            width={800}
            height={450}
            className="w-full h-auto max-h-64 object-contain"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
            }}
            className="absolute top-2 right-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
