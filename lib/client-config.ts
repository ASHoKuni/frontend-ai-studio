const OPENAI_KEY = "fas_openai_key";
const FIGMA_KEY = "fas_figma_token";

export const clientConfig = {
  getOpenAIKey: (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(OPENAI_KEY) ?? "";
  },
  setOpenAIKey: (key: string) => {
    localStorage.setItem(OPENAI_KEY, key.trim());
  },
  getFigmaToken: (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(FIGMA_KEY) ?? "";
  },
  setFigmaToken: (token: string) => {
    localStorage.setItem(FIGMA_KEY, token.trim());
  },
  clearAll: () => {
    localStorage.removeItem(OPENAI_KEY);
    localStorage.removeItem(FIGMA_KEY);
  },
  hasOpenAIKey: (): boolean => !!clientConfig.getOpenAIKey(),
  hasFigmaToken: (): boolean => !!clientConfig.getFigmaToken(),
};

/** Returns headers to attach to every tool API request */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const openaiKey = clientConfig.getOpenAIKey();
  const figmaToken = clientConfig.getFigmaToken();
  if (openaiKey) headers["x-openai-key"] = openaiKey;
  if (figmaToken) headers["x-figma-token"] = figmaToken;
  return headers;
}
