'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Rss, 
  Globe, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  RotateCw, 
  AlertCircle, 
  Play,
  ExternalLink,
  Code2
} from 'lucide-react';
import { Source } from '@/lib/types';

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ id: string; count: number; preview: any[] } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add Source Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    url: '',
    type: 'rss',
    weight: 1.0,
    selectors: {
      item: 'article',
      title: 'h2 a',
      link: 'h2 a@href',
      summary: 'p',
      published: 'time@datetime',
    },
  });
  const [testingAdd, setTestingAdd] = useState(false);
  const [addPreview, setAddPreview] = useState<{ count: number; preview: any[]; discoveredFeedUrl?: string } | null>(null);

  // Edit Source Modal State
  const [editingSource, setEditingSource] = useState<Source | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      if (data.sources) {
        setSources(data.sources);
      }
    } catch {
      showNotification('Failed to load sources', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleToggleEnabled = async (source: Source) => {
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === source.id ? { ...s, enabled: !s.enabled } : s))
        );
        showNotification(`${source.name} ${!source.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch {
      showNotification('Failed to toggle source status', 'error');
    }
  };

  const handleTestSource = async (sourceId: string) => {
    try {
      setTestingId(sourceId);
      const res = await fetch(`/api/sources/${sourceId}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTestResults({ id: sourceId, count: data.count, preview: data.preview || [] });
        showNotification(`Fetched ${data.count} items preview successfully!`);
      } else {
        showNotification(data.error || 'Failed to fetch preview', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestNewSource = async () => {
    if (!addForm.url.trim()) {
      showNotification('Please enter a website or feed URL', 'error');
      return;
    }
    try {
      setTestingAdd(true);
      setAddPreview(null);
      const res = await fetch('/api/sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        setAddPreview(data);
        if (data.discoveredFeedUrl && data.discoveredFeedUrl !== addForm.url) {
          setAddForm((prev) => ({ ...prev, url: data.discoveredFeedUrl }));
        }
        showNotification(`Found ${data.count} items! Preview available below.`);
      } else {
        showNotification(data.error || 'Test failed', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingAdd(false);
    }
  };

  const handleSaveNewSource = async () => {
    if (!addForm.url.trim()) {
      showNotification('Please enter a URL', 'error');
      return;
    }
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok && data.source) {
        setSources((prev) => [...prev, data.source]);
        setIsAddOpen(false);
        setAddForm({
          name: '',
          url: '',
          type: 'rss',
          weight: 1.0,
          selectors: {
            item: 'article',
            title: 'h2 a',
            link: 'h2 a@href',
            summary: 'p',
            published: 'time@datetime',
          },
        });
        setAddPreview(null);
        showNotification('Source added successfully!');
      } else {
        showNotification(data.error || 'Failed to add source', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleUpdateSource = async () => {
    if (!editingSource) return;
    try {
      const res = await fetch(`/api/sources/${editingSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSource),
      });
      const data = await res.json();
      if (res.ok && data.source) {
        setSources((prev) => prev.map((s) => (s.id === data.source.id ? data.source : s)));
        setEditingSource(null);
        showNotification('Source updated successfully!');
      } else {
        showNotification(data.error || 'Failed to update source', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete source "${name}"?`)) return;
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        showNotification('Source deleted');
      }
    } catch {
      showNotification('Failed to delete source', 'error');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Notification Toast */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">News Sources</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage RSS feeds and HTML scrapers. Auto-discovers RSS feeds from regular site URLs.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" /> Add News Source
        </button>
      </div>

      {/* Sources Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Source Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Weight</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Fetched</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading news sources...
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No sources found. Click &quot;Add News Source&quot; to get started.
                  </td>
                </tr>
              ) : (
                sources.map((source) => (
                  <tr key={source.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                          {source.type === 'rss' ? <Rss className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{source.name}</p>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-400 hover:text-blue-500 truncate block max-w-xs"
                          >
                            {source.url}
                          </a>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="uppercase text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {source.type}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                      {source.weight}x
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleEnabled(source)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          source.enabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {source.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>{source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString() : 'Never'}</div>
                      {source.lastError && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 mt-0.5 font-medium truncate max-w-xs">
                          <AlertCircle className="w-3 h-3 shrink-0" /> Error: {source.lastError}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleTestSource(source.id)}
                          disabled={testingId === source.id}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Test parse feed"
                        >
                          {testingId === source.id ? <RotateCw className="w-4 h-4 animate-spin text-blue-600" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingSource(source)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Source"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id, source.name)}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Preview Modal */}
      {testResults && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl w-full space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Feed Preview ({testResults.count} articles discovered)
              </h3>
              <button onClick={() => setTestResults(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {testResults.preview.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {item.title} <ExternalLink className="w-3 h-3" />
                  </a>
                  {item.summary && <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.summary}</p>}
                  <p className="text-[11px] text-slate-400">{new Date(item.publishedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setTestResults(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source Dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add News Source</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Website or RSS Feed URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={addForm.url}
                    onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                    placeholder="https://techcrunch.com or feed url"
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestNewSource}
                    disabled={testingAdd}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5"
                  >
                    {testingAdd ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Auto-Discover & Test
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Display Name
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. TechCrunch"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rss">RSS Feed</option>
                    <option value="html">HTML Scraper</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Trend Weight Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={addForm.weight}
                    onChange={(e) => setAddForm({ ...addForm, weight: parseFloat(e.target.value) || 1.0 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* HTML Selectors editor if type is HTML */}
              {addForm.type === 'html' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Code2 className="w-4 h-4" /> CSS Selectors Configuration
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-slate-500 block">Item Container</label>
                      <input
                        type="text"
                        value={addForm.selectors.item}
                        onChange={(e) => setAddForm({ ...addForm, selectors: { ...addForm.selectors, item: e.target.value } })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block">Title</label>
                      <input
                        type="text"
                        value={addForm.selectors.title}
                        onChange={(e) => setAddForm({ ...addForm, selectors: { ...addForm.selectors, title: e.target.value } })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block">Link (with @href)</label>
                      <input
                        type="text"
                        value={addForm.selectors.link}
                        onChange={(e) => setAddForm({ ...addForm, selectors: { ...addForm.selectors, link: e.target.value } })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block">Summary</label>
                      <input
                        type="text"
                        value={addForm.selectors.summary}
                        onChange={(e) => setAddForm({ ...addForm, selectors: { ...addForm.selectors, summary: e.target.value } })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Add Preview Box */}
              {addPreview && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Discovery Passed: {addPreview.count} articles found
                  </div>
                  {addPreview.preview.slice(0, 2).map((p, i) => (
                    <div key={i} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      • {p.title}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewSource}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save News Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Source Dialog */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Source</h3>
              <button onClick={() => setEditingSource(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Name</label>
                <input
                  type="text"
                  value={editingSource.name}
                  onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Feed URL</label>
                <input
                  type="url"
                  value={editingSource.url}
                  onChange={(e) => setEditingSource({ ...editingSource, url: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Weight Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingSource.weight}
                    onChange={(e) => setEditingSource({ ...editingSource, weight: parseFloat(e.target.value) || 1.0 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                  <select
                    value={editingSource.type}
                    onChange={(e) => setEditingSource({ ...editingSource, type: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rss">RSS</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingSource(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSource}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Update Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
