'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Copy, 
  Sparkles, 
  Share2, 
  Save, 
  Trash2, 
  Check, 
  X, 
  CheckCircle2, 
  RotateCw,
  ExternalLink,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { Post } from '@/lib/types';
import { computeTweetLength } from '@/lib/pipeline/assemble';

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) throw new Error('Post not found');
      const data: Post = await res.json();
      setPost(data);
      setTitle(data.title);
      setCaption(data.caption);
      setTags(data.tags || []);
      setImageUrl(data.imageUrl || '');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Live character calculation under X rules (URL counts as 23 chars)
  const currentLength = computeTweetLength(caption, tags, post?.link);
  const isOverLimit = currentLength > 280;

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    let clean = tagInput.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    clean = clean.replace(/[^a-zA-Z0-9_#]/g, '');
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          caption,
          tags,
          imageUrl: imageUrl.trim() || null,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Failed to save post');
      setPost(updated);
      showNotification('Post updated and tweet reassembled successfully!');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const res = await fetch(`/api/posts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: customInstruction }),
      });
      const data = await res.json();
      if (!res.ok || !data.post) throw new Error(data.error || 'Failed to regenerate');
      setPost(data.post);
      setTitle(data.post.title);
      setCaption(data.post.caption);
      setTags(data.post.tags || []);
      setImageUrl(data.post.imageUrl || '');
      showNotification('Post regenerated with Groq!');
      setCustomInstruction('');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post draft?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      }
    } catch {
      showNotification('Failed to delete post', 'error');
    }
  };

  const handleCopyTweet = () => {
    if (!post) return;
    navigator.clipboard.writeText(post.tweetText);
    setCopied(true);
    showNotification('Tweet copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getTwitterIntentUrl = () => {
    if (!post) return '#';
    const textPart = `${caption}\n\n${tags.join(' ')}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(textPart)}&url=${encodeURIComponent(post.link)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RotateCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Post not found</h3>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
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

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Post Editor & X Preview</h2>
            <p className="text-xs text-slate-500">Edit fields, review live character length, and post to X.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editable Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Content Details</h3>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex justify-between">
                <span>Headline Title</span>
                <span className={title.length > 80 ? 'text-rose-500' : 'text-slate-400'}>{title.length}/80</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex justify-between">
                <span>Tweet Caption Body</span>
                <span className={caption.length > 220 ? 'text-rose-500' : 'text-slate-400'}>{caption.length}/220</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Hashtag Editor */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Hashtags ({tags.length} active)
              </label>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-h-[50px] items-center">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag and press enter..."
                    className="bg-transparent border-none text-xs focus:outline-none w-full"
                  />
                </div>
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Image URL (Extracted from Article)
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Source Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Canonical Source Article URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  value={post.link}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 text-xs font-mono text-slate-500 cursor-not-allowed"
                />
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Regenerate Section */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" /> AI Rewrite with Groq
            </h3>
            <p className="text-xs text-slate-500">
              Pass a custom prompt to rewrite this post (e.g. &quot;make it more technical&quot;, &quot;sound like a breaking news alert&quot;).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Optional instruction for Groq..."
                className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5"
              >
                {regenerating ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Rewrite
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live X Tweet Preview & Story Cluster */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live X Tweet Card */}
          <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live X Post Preview</span>
              {/* Character Counter */}
              <div
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isOverLimit
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {currentLength} / 280
              </div>
            </div>

            {/* Tweet Author Mock */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                X
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">Tech News Bot</span>
                  <span className="text-xs text-slate-500">@technews</span>
                  <span className="text-xs text-slate-400">· now</span>
                </div>

                {/* Tweet Body Preview */}
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {caption || 'Your tweet caption hook will appear here...'}
                  </p>

                  {tags.length > 0 && (
                    <p className="text-sm text-blue-500 dark:text-blue-400 font-medium">
                      {tags.join(' ')}
                    </p>
                  )}

                  {post.link && (
                    <p className="text-sm text-blue-500 dark:text-blue-400 break-all underline">
                      {post.link}
                    </p>
                  )}
                </div>

                {/* Media Card */}
                {imageUrl && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-48 object-cover"
                      onError={() => setImageUrl('')}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Under Preview */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={handleCopyTweet}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Tweet'}
              </button>

              <a
                href={getTwitterIntentUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" /> Post on X
              </a>
            </div>
          </div>

          {/* Underlying Cluster Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" /> Story Cluster Outlets
            </h3>
            <p className="text-xs text-slate-500">
              Trend score: <span className="font-semibold text-slate-800 dark:text-slate-200">{post.trendScore.toFixed(1)}</span> (Covered across multiple sources)
            </p>

            <div className="space-y-2 pt-1">
              {(post.cluster?.articles || []).map((art: any) => (
                <a
                  key={art.url}
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {art.source?.name || art.source || 'News Source'}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                    {art.title}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
