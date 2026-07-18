import { TOOLS } from "@/lib/tools";
import { ToolPage } from "@/components/shared/ToolPage";
import { DesignToCodePage } from "@/components/tools/DesignToCodePage";
import { BundleAnalyzerPage } from "@/components/tools/BundleAnalyzerPage";
import { LighthouseAuditPage } from "@/components/tools/LighthouseAuditPage";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ toolId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { toolId } = await params;
  const tool = TOOLS.find((t) => t.id === toolId);

  if (!tool) {
    notFound();
  }

  if (tool.inputType === "design") {
    return <DesignToCodePage />;
  }

  if (tool.id === "bundle") {
    return <BundleAnalyzerPage />;
  }

  if (tool.id === "lighthouse") {
    return <LighthouseAuditPage />;
  }

  return <ToolPage tool={tool} />;
}

export async function generateStaticParams() {
  return TOOLS.map((tool) => ({ toolId: tool.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { toolId } = await params;
  const tool = TOOLS.find((t) => t.id === toolId);
  return {
    title: tool ? `${tool.name} — Frontend AI Studio` : "Frontend AI Studio",
  };
}
