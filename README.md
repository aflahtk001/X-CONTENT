# Tech News → Twitter/X Content Generator

An automated trending tech news pipeline and Twitter/X content generator built with **Next.js 14+ (App Router)**, **Groq API** (Llama 3.3 70B), and **Supabase (PostgreSQL)**, designed for deployment on **Cloudflare**.

---

## ⚡ Features

* **Multi-Source Ingestion**: Ingests articles from RSS feeds and HTML scrapers in parallel with SSRF protection.
* **Auto-Discovery**: Automatically discovers RSS/Atom feeds from any website URL.
* **Hacker News Signals**: Fetches trending front-page points from Hacker News to boost cluster trend scores.
* **Story Clustering**: Normalizes titles and groups identical stories across outlets using Jaccard token similarity.
* **Trend Scoring Algorithm**: Multi-factor scoring weighting outlet authority, cross-outlet coverage, Hacker News points, and recency.
* **Smart Page Analysis**: Automatically extracts top OpenGraph / Twitter images and clean body text using `@mozilla/readability`.
* **Laya Decision & Virality Engine**: Evaluates news virality, filters routine updates, and uses local Laya model (`convaiinnovations/laya`) as an editorial judge to re-rank candidate hooks for maximum CTR.
* **Groq LLM Generation**: Generates 3 diverse high-engagement copywriting angles (Curiosity Gap, Contrarian Shift, High-Impact Insight).
* **X-Compliant 280-Character Rule**: Accurately counts URLs as 23 characters; automatically drops hashtags before trimming text.
* **Interactive Studio UI**:
  * **Dashboard**: Run now trigger, real-time status polling, filter by status (Drafts, Approved, Posted, Rejected), 1-click copy, download image, and Open on X.
  * **Post Detail / Editor**: Live X post preview, interactive hashtag chip editor, alternate image picker, and live character counter.
  * **AI Rewrite / Regenerate**: Re-prompt Groq with custom editorial instructions.
  * **Sources Management**: Live preview feed testing, weight multipliers, and CSS selector editor.
  * **Observability & Logs**: Step-by-step pipeline execution logs.
  * **Settings**: Change Groq models, test Laya decision engine connectivity, cron schedules, timezones, and tone of voice.

---

## 🚀 Quick Setup Guide

### 1. Database Setup in Supabase
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** → **New query**.
3. Open `supabase_schema_and_seed.sql` in this repo, copy its entire contents, paste into the SQL Editor, and click **Run**.
4. This creates all tables (`Source`, `Article`, `Cluster`, `Post`, `Run`, `Setting`), sets up RLS policies, and seeds default settings and initial news feeds.

### 2. Environment Configuration
Check `.env.local` (or copy `.env.example` to `.env.local`):
```env
# Groq API
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_optional_service_role_key

# Laya Decision Engine (Local)
LAYA_API_URL=http://127.0.0.1:8000

# Scheduler
SCHEDULER_MODE=internal # or "external" for Cloudflare Cron / Vercel Cron
CRON_SECRET=super-secret-cron-token-123
DEFAULT_TIMEZONE=Asia/Kolkata
```

### 3. Start Development Server (Auto-boots Laya & Next.js)
```bash
npm run dev
```
> Running `npm run dev` automatically detects your local Python `.venv`, launches the **Laya Decision Model** backend service on `http://127.0.0.1:8000`, and starts the **Next.js frontend** concurrently with unified logs.

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### 4. Run Unit Tests
```bash
npm test
```

---

## 🌐 Deploying to Cloudflare

1. **Host on Cloudflare Pages / Workers**:
   * Build using `@cloudflare/next-on-pages` or OpenNext Cloudflare adapter.
   * Add the environment variables from `.env.local` into Cloudflare Pages / Workers dashboard settings.
2. **Setup Scheduled Cron Triggers on Cloudflare**:
   * Set `SCHEDULER_MODE=external` in your environment variables.
   * Create a Cloudflare Cron Trigger (or Cloudflare Worker Cron) to send a `POST` request to your deployed app:
     ```bash
     curl -X POST https://your-domain.pages.dev/api/cron/run \
       -H "Authorization: Bearer super-secret-cron-token-123"
     ```

---

## 📁 Project Architecture

```
/
├─ app/
│  ├─ page.tsx               # Dashboard with live post grid & run trigger
│  ├─ posts/[id]/page.tsx    # Post detail, editor & live X preview
│  ├─ sources/page.tsx       # News sources & auto-discovery preview
│  ├─ runs/page.tsx          # Execution history & structured log viewer
│  ├─ settings/page.tsx      # Groq model, scheduling, & tone configuration
│  └─ api/                   # REST API routes for runs, posts, sources, cron, settings
├─ lib/
│  ├─ pipeline/
│  │  ├─ ingest.ts           # RSS + HTML scraping + Hacker News signals + feed discovery
│  │  ├─ normalize.ts        # URL canonicalization, age filter, deduplication
│  │  ├─ cluster.ts          # Title tokenization & Jaccard similarity clustering
│  │  ├─ score.ts            # Multi-source trend scoring algorithm
│  │  ├─ analyze-page.ts     # OpenGraph/Twitter image & Readability text extraction
│  │  ├─ generate.ts         # Groq LLM post generation, JSON validation & sanitizer
│  │  ├─ assemble.ts         # 280-char X tweet assembler (URL = 23 chars)
│  │  └─ run.ts              # Full run orchestrator with concurrency lock
│  ├─ groq.ts                # Groq SDK client with exponential backoff
│  ├─ safe-fetch.ts          # SSRF protection, timeout, and retry helper
│  ├─ scheduler.ts           # Node-cron scheduler
│  ├─ supabase.ts            # Supabase database client
│  └─ types.ts               # TypeScript data model types
├─ config/sources.json       # Seed sources definition
├─ supabase_schema_and_seed.sql # Supabase SQL schema & seed script
└─ tests/                    # Vitest unit test suite
```
