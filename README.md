# 🧠 Frontend AI Studio

> **NamasteDev × OpenAI Hackathon 2026**

An AI-powered toolkit with **9 specialized tools** for frontend developers — built with OpenAI GPT-4o, Playwright, esbuild, and Next.js 15.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit-violet?style=for-the-badge)](https://your-vercel-url.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-ASHoKuni%2Ffrontend--ai--studio-black?style=for-the-badge&logo=github)](https://github.com/ASHoKuni/frontend-ai-studio)

**Repository:** https://github.com/ASHoKuni/frontend-ai-studio

---

## ✨ Features

| Tool | Description |
|---|---|
| 🎨 **Design to Code** | Upload screenshot / Figma URL / Live website URL → React + Tailwind component with live preview |
| 🖼️ **Screenshot Analyzer** | Analyze UI screenshots for component breakdown, accessibility issues & improvements |
| ⚛️ **Component Generator** | Describe a component → get production-ready React + Tailwind code + live preview |
| 🔍 **AI Code Review** | Thorough code review: bugs, security vulnerabilities, performance & style |
| 🏗️ **Architecture Review** | Detect prop drilling, unnecessary re-renders, coupling & get a refactoring roadmap |
| ♿ **Accessibility Checker** | WCAG 2.1 audit — find and fix accessibility violations with exact fixes |
| ⚡ **Performance Analyzer** | Identify re-render issues, missing memoization & bundle optimizations |
| 📦 **Bundle Analyzer** | Connect a GitHub repo or upload ZIP → real Bundlephobia sizes + priority report |
| 🔦 **Lighthouse Analyzer** | Real Core Web Vitals via Playwright (LCP, CLS, TBT) + visual score gauges |

---

## 🚀 What Makes It Different

- **Real browser automation** — Playwright captures live website screenshots and real Core Web Vitals
- **Real bundle sizes** — Bundlephobia API for actual package sizes, not estimates
- **Live component preview** — esbuild transpiles generated TypeScript server-side, renders in isolated iframe
- **Full project analysis** — GitHub URL → scan all source files → priority bundle report
- **Figma to Code** — Figma API fetches frame as PNG → GPT-4o generates pixel-perfect React component
- **AI with real data** — GPT-4o always receives actual measured metrics, not fabricated numbers
- **Zero server storage** — API keys stored in browser localStorage only, never logged

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI | OpenAI GPT-4o (Vision + Code) |
| Browser | Playwright (headless Chromium) |
| Transpiler | esbuild (server-side TSX → JS) |
| Bundle data | Bundlephobia API |
| Figma | Figma Images REST API |
| GitHub | GitHub Trees + Raw Content API |

---

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- OpenAI API key (GPT-4o access required)

### Installation

```bash
git clone https://github.com/ASHoKuni/frontend-ai-studio.git
cd frontend-ai-studio
npm install
npx playwright install chromium
```

### Environment Variables

Create `.env.local`:

```env
# Required
OPENAI_API_KEY=sk-proj-...

# Optional — for Figma URL import in Design to Code
FIGMA_ACCESS_TOKEN=figd_...

# Optional — increases GitHub API limit from 60 to 5000 req/hr
GITHUB_TOKEN=ghp_...
```

> **Tip:** You can also set API keys directly in the app UI via the **API Keys** button in the sidebar — no `.env` editing needed.

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎯 Demo Highlights

### Design to Code — Live URL mode
Enter any website URL → Playwright captures a 1440×900 screenshot → GPT-4o generates the React component → rendered live in iframe.

```
https://stripe.com/pricing → React + Tailwind PricingPage component (30 seconds)
```

### Bundle Analyzer — Full project
```
GitHub URL → fetch all source files → Bundlephobia real sizes → priority report with before/after
```

### Lighthouse — Real metrics
```
Enter URL → headless Chrome measures LCP/CLS/TBT → visual score gauges + AI fix plan
```

---

## 📁 Project Structure

```
frontend-ai-studio/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── tools/[toolId]/page.tsx     # Dynamic tool routing
│   └── api/
│       ├── tools/          # 9 AI streaming endpoints
│       ├── bundle/         # Bundlephobia + report
│       ├── github/         # GitHub repo analyzer
│       ├── figma/          # Figma image fetcher
│       ├── screenshot/     # Playwright URL screenshot
│       ├── lighthouse/     # Playwright Web Vitals audit
│       └── preview/        # esbuild TypeScript transpiler
├── components/
│   ├── layout/             # Sidebar + Settings modal
│   ├── shared/             # ToolPage, AIOutput, CodeEditor, FileUpload
│   └── tools/              # BundleAnalyzerPage, DesignToCodePage, LighthouseAuditPage
└── lib/
    ├── openai.ts, prompts.ts, tools.ts, utils.ts, client-config.ts
```

---

## 🔑 API Keys

All keys are stored **only in your browser's localStorage** and sent as request headers to the app's own API routes. Nothing is logged or persisted server-side.

Get your keys:
- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Figma:** figma.com → Profile → Settings → Personal Access Tokens
- **GitHub:** github.com → Settings → Developer settings → Personal access tokens

---

## 📄 License

MIT — Built for the [NamasteDev × OpenAI Hackathon 2026](https://namastedev.com/hackathon)


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
