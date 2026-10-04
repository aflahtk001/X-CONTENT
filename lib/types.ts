export type SourceType = 'rss' | 'html';

export interface SourceSelectors {
  item?: string;
  title?: string;
  link?: string;
  summary?: string;
  published?: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  enabled: boolean;
  weight: number;
  selectors?: SourceSelectors | null;
  lastFetchedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export interface RawArticleItem {
  source: string;
  title: string;
  url: string;
  summary?: string | null;
  publishedAt: Date;
  points?: number;
  mediaImage?: string | null;
}

export interface Article {
  id: string;
  sourceId: string;
  source?: Source;
  title: string;
  url: string;
  summary?: string | null;
  publishedAt: string;
  fetchedAt: string;
  clusterId?: string | null;
}

export interface Cluster {
  id: string;
  runId: string;
  headline: string;
  score: number;
  sourceCount: number;
  hnPoints: number;
  articles?: Article[];
}

export type PostStatus = 'draft' | 'approved' | 'rejected' | 'posted';

export interface Post {
  id: string;
  clusterId: string;
  cluster?: Cluster & { articles?: (Article & { source?: Source })[] };
  title: string;
  caption: string;
  tags: string[];
  imageUrl?: string | null;
  link: string;
  tweetText: string;
  status: PostStatus;
  trendScore: number;
  model: string;
  coveredBy?: string[];
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
}

export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface RunLogEntry {
  step: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  sourceName?: string;
}

export interface Run {
  id: string;
  trigger: 'schedule' | 'manual';
  startedAt: string;
  finishedAt?: string | null;
  status: RunStatus;
  articlesFetched: number;
  postsCreated: number;
  log?: RunLogEntry[] | null;
  clusters?: Cluster[];
}

export interface AppSettings {
  schedule_cron: string;
  timezone: string;
  posts_per_run: number;
  max_age_hours: number;
  groq_model: string;
  tone: string;
  brand_hashtags: string[];
  use_hacker_news: boolean;
  require_image: boolean;
}
