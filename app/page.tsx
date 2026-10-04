'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Play, 
  RotateCw, 
  Copy, 
  ExternalLink, 
  Check, 
  X, 
  Download, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Clock, 
  Share2,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { Post, PostStatus, Run } from '@/lib/types';

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [customPromptModal, setCustomPromptModal] = useState<{ id: string; open: boolean } | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchPosts = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      const url = selectedStatus === 'all' 
        ? `/api/posts?_t=${Date.now()}` 
        : `/api/posts?status=${selectedStatus}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs?limit=1&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.runs && data.runs.length > 0) {
        const latest = data.runs[0];
        setLastRun(latest);
        setIsRunning(latest.status === 'running');
      }
    } catch (err) {
      console.error('Failed to fetch runs status:', err);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchRuns();
  }, [fetchPosts, fetchRuns]);

  // Polling when a run is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/runs?limit=1&_t=${Date.now()}`, { cache: 'no-store' });
          const data = await res.json();
          if (data.runs && data.runs.length > 0) {
            const latest = data.runs[0];
            setLastRun(latest);
            if (latest.status !== 'running') {
              setIsRunning(false);
              fetchPosts(); // Refresh posts immediately upon completion
            }
          }
        } catch {
          // ignore polling errors
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, fetchPosts]);

  const handleRunNow = async () => {
    try {
      setIsRunning(true);
      showNotification('Pipeline run started in background...', 'success');
      const res = await fetch('/api/runs', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setIsRunning(false);
        showNotification(data.error || 'Failed to start run', 'error');
      } else {
        fetchRuns();
      }
    } catch (err: any) {
      setIsRunning(false);
      showNotification(err.message || 'Error starting run', 'error');
    }
  };

  const handleStatusChange = async (postId: string, newStatus: PostStatus) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showNotification(`Post marked as ${newStatus}`);
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p)));
      }
    } catch {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleCopyTweet = (post: Post) => {
    navigator.clipboard.writeText(post.tweetText);
    setCopiedId(post.id);
    showNotification('Tweet copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    showNotification('Image URL copied to clipboard!');
  };

  const handleDownloadImage = async (imageUrl?: string | null, title?: string) => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(title || 'news-image').slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      showNotification('Image downloaded!');
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleRegenerate = async (postId: string) => {
    try {
      setRegeneratingId(postId);
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: customInstruction }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        showNotification('Post regenerated successfully with Groq!');
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
        setCustomPromptModal(null);
        setCustomInstruction('');
      } else {
        showNotification(data.error || 'Failed to regenerate post', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Regeneration error', 'error');
    } finally {
      setRegeneratingId(null);
    }
  };

  const getTwitterIntentUrl = (post: Post) => {
    const textPart = `${post.caption}\n\n${(post.tags || []).join(' ')}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(textPart)}&url=${encodeURIComponent(post.link)}`;
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
            notification.type === 'success' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-red-600 text-white'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Top Banner & Run Trigger */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Trending Content Feed</h2>
            {lastRun?.status === 'running' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                <RotateCw className="w-3 h-3 animate-spin" /> Ingestion & Groq Pipeline Running...
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Last run: {lastRun ? new Date(lastRun.startedAt).toLocaleString() : 'Never'}
            {lastRun && (
              <span className={`capitalize font-medium ${lastRun.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                ({lastRun.status} • {lastRun.postsCreated} posts created)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchPosts(true);
              fetchRuns();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-sm"
            title="Refresh Feed"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunNow}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isRunning
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" /> Processing Run...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Run Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1">
          {[
            { id: 'draft', label: 'Drafts' },
            { id: 'approved', label: 'Approved' },
            { id: 'posted', label: 'Posted' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All Posts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === tab.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Showing {posts.length} {selectedStatus === 'all' ? 'total' : selectedStatus} {posts.length === 1 ? 'post' : 'posts'}
          </span>
          <button
            onClick={() => fetchPosts(true)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Reload posts"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse p-4 space-y-4">
              <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No {selectedStatus} posts found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Click &quot;Run Now&quot; above to check your news feeds, score trending stories, and generate ready-to-post Twitter drafts with Groq.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow group"
            >
              <div>
                {/* Image Banner */}
                <div className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-xs">No image available</span>
                    </div>
                  )}

                  {/* Status & Trend Score Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/80 backdrop-blur-md text-white flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      Score: {post.trendScore.toFixed(1)}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize backdrop-blur-md shadow-sm ${
                        post.status === 'approved'
                          ? 'bg-emerald-500/90 text-white'
                          : post.status === 'posted'
                          ? 'bg-blue-500/90 text-white'
                          : post.status === 'rejected'
                          ? 'bg-rose-500/90 text-white'
                          : 'bg-amber-500/90 text-white'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  {/* Sources Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Covered by:
                    </span>
                    {(post.coveredBy || []).map((sourceName) => (
                      <span
                        key={sourceName}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {sourceName}
                      </span>
                    ))}
                  </div>

                  {/* Headline Title */}
                  <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2 leading-snug">
                    {post.title}
                  </h3>

                  {/* Caption Body */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {post.caption}
                  </p>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(post.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                {/* Primary Actions */}
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => handleCopyTweet(post)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    title="Copy assembled tweet"
                  >
                    {copiedId === post.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === post.id ? 'Copied' : 'Copy Tweet'}
                  </button>

                  <a
                    href={getTwitterIntentUrl(post)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Post on X
                  </a>

                  <Link
                    href={`/posts/${post.id}`}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit and view tweet details"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                {/* Secondary Actions (Image & Status) */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    {post.imageUrl && (
                      <>
                        <button
                          onClick={() => handleDownloadImage(post.imageUrl, post.title)}
                          className="p-1 rounded hover:text-slate-900 dark:hover:text-white"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyImageUrl(post.imageUrl)}
                          className="p-1 rounded hover:text-slate-900 dark:hover:text-white text-[11px]"
                          title="Copy Image URL"
                        >
                          Copy img
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setCustomPromptModal({ id: post.id, open: true })}
                      disabled={regeneratingId === post.id}
                      className="p-1 rounded hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                      title="Regenerate with Groq"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${regeneratingId === post.id ? 'animate-spin text-blue-500' : ''}`} />
                      <span className="text-[11px]">Regen</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {post.status !== 'approved' && (
                      <button
                        onClick={() => handleStatusChange(post.id, 'approved')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      >
                        Approve
                      </button>
                    )}
                    {post.status !== 'rejected' && (
                      <button
                        onClick={() => handleStatusChange(post.id, 'rejected')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        Reject
                      </button>
                    )}
                    {post.status !== 'posted' && (
                      <button
                        onClick={() => handleStatusChange(post.id, 'posted')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        Mark Posted
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Instruction Regenerate Modal */}
      {customPromptModal?.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" /> Regenerate Tweet
              </h3>
              <button
                onClick={() => setCustomPromptModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Provide optional custom instructions to guide Groq (e.g., &quot;make it punchier&quot;, &quot;focus on developer impact&quot;, &quot;more humorous tone&quot;):
            </p>

            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="e.g. Focus on the AI architecture breakthroughs..."
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomPromptModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRegenerate(customPromptModal.id)}
                disabled={regeneratingId === customPromptModal.id}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
              >
                {regeneratingId === customPromptModal.id ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Regenerate with Groq
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
