-- ==============================================================================
-- TECH NEWS -> TWITTER/X GENERATOR: SUPABASE SCHEMA & SEED SCRIPT
-- Run this in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS "Source" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT UNIQUE NOT NULL,
  "type" TEXT NOT NULL, -- 'rss' | 'html'
  "url" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "selectors" JSONB,
  "lastFetchedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Run" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trigger" TEXT NOT NULL, -- 'schedule' | 'manual'
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "finishedAt" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'partial' | 'failed'
  "articlesFetched" INTEGER NOT NULL DEFAULT 0,
  "postsCreated" INTEGER NOT NULL DEFAULT 0,
  "log" JSONB
);

CREATE TABLE IF NOT EXISTS "Cluster" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "headline" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "sourceCount" INTEGER NOT NULL,
  "hnPoints" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Article" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sourceId" TEXT NOT NULL REFERENCES "Source"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "url" TEXT UNIQUE NOT NULL,
  "summary" TEXT,
  "publishedAt" TIMESTAMPTZ NOT NULL,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "clusterId" TEXT REFERENCES "Cluster"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Post" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "clusterId" TEXT UNIQUE NOT NULL REFERENCES "Cluster"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "tags" JSONB NOT NULL,
  "imageUrl" TEXT,
  "link" TEXT NOT NULL,
  "tweetText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'rejected' | 'posted'
  "trendScore" DOUBLE PRECISION NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "postedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL
);

-- 2. Configure Row Level Security (Allow all operations for anon/backend access)
ALTER TABLE "Source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cluster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Source_allow_all" ON "Source";
CREATE POLICY "Source_allow_all" ON "Source" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Run_allow_all" ON "Run";
CREATE POLICY "Run_allow_all" ON "Run" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cluster_allow_all" ON "Cluster";
CREATE POLICY "Cluster_allow_all" ON "Cluster" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Article_allow_all" ON "Article";
CREATE POLICY "Article_allow_all" ON "Article" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Post_allow_all" ON "Post";
CREATE POLICY "Post_allow_all" ON "Post" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Setting_allow_all" ON "Setting";
CREATE POLICY "Setting_allow_all" ON "Setting" FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed Default Settings
INSERT INTO "Setting" ("key", "value") VALUES
  ('schedule_cron', '"0 */3 * * *"'::jsonb),
  ('timezone', '"Asia/Kolkata"'::jsonb),
  ('posts_per_run', '3'::jsonb),
  ('max_age_hours', '24'::jsonb),
  ('groq_model', '"openai/gpt-oss-120b"'::jsonb),
  ('tone', '"informative, energetic, slightly witty, no clickbait"'::jsonb),
  ('brand_hashtags', '[]'::jsonb),
  ('use_hacker_news', 'true'::jsonb),
  ('require_image', 'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;

-- 4. Seed Initial News Sources
INSERT INTO "Source" ("name", "type", "url", "enabled", "weight") VALUES
  ('TechCrunch', 'rss', 'https://techcrunch.com/feed/', true, 1.0),
  ('The Verge', 'rss', 'https://www.theverge.com/rss/index.xml', true, 1.0),
  ('The Verge (Tech & AI)', 'rss', 'https://www.theverge.com/rss/tech/index.xml', true, 1.2),
  ('Ars Technica', 'rss', 'https://feeds.arstechnica.com/arstechnica/index', true, 1.0),
  ('Wired', 'rss', 'https://www.wired.com/feed/rss', true, 1.0),
  ('VentureBeat AI', 'rss', 'https://venturebeat.com/category/ai/feed/', true, 1.5),
  ('OpenAI News', 'rss', 'https://openai.com/news/rss.xml', true, 2.0),
  ('Hugging Face', 'rss', 'https://huggingface.co/blog/feed.xml', true, 1.5),
  ('GitHub Blog', 'rss', 'https://github.blog/feed/', true, 1.2),
  ('9to5Mac', 'rss', 'https://9to5mac.com/feed/', true, 1.0),
  ('MIT Tech Review', 'rss', 'https://www.technologyreview.com/feed/', true, 1.2),
  ('Engadget', 'rss', 'https://www.engadget.com/rss.xml', true, 1.0),
  -- Space Feeds
  ('NASA Breaking News', 'rss', 'https://www.nasa.gov/news-release/feed/', true, 1.4),
  ('Ars Technica Space', 'rss', 'https://arstechnica.com/space/feed/', true, 1.3),
  ('SpaceFlight Now', 'rss', 'https://spaceflightnow.com/feed/', true, 1.2),
  ('Universe Today', 'rss', 'https://www.universetoday.com/feed/', true, 1.1),
  ('ESA (European Space Agency)', 'rss', 'https://www.esa.int/rssfeed/Our_Activities/Space_News', true, 1.2),
  -- Gaming Feeds
  ('IGN', 'rss', 'https://feeds.feedburner.com/ign/all', true, 1.3),
  ('Polygon', 'rss', 'https://www.polygon.com/rss/index.xml', true, 1.3),
  ('Push Square (PlayStation)', 'rss', 'https://www.pushsquare.com/feeds/latest', true, 1.1),
  ('Pure Xbox', 'rss', 'https://www.purexbox.com/feeds/latest', true, 1.1),
  -- Geopolitics & World Feeds
  ('Foreign Policy', 'rss', 'https://foreignpolicy.com/feed/', true, 1.4),
  ('The Diplomat', 'rss', 'https://thediplomat.com/feed/', true, 1.3),
  ('War on the Rocks', 'rss', 'https://warontherocks.com/feed/', true, 1.3),
  ('BBC News World', 'rss', 'https://feeds.bbci.co.uk/news/world/rss.xml', true, 1.2),
  ('The Guardian World', 'rss', 'https://www.theguardian.com/world/rss', true, 1.2),
  ('Al Jazeera English', 'rss', 'https://www.aljazeera.com/xml/rss/all.xml', true, 1.2),
  ('Geopolitical Monitor', 'rss', 'https://www.geopoliticalmonitor.com/feed/', true, 1.2)
ON CONFLICT ("name") DO NOTHING;


