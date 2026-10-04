'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  X, 
  Clock, 
  Zap, 
  Hash, 
  Sliders, 
  Image as ImageIcon
} from 'lucide-react';
import { AppSettings } from '@/lib/types';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Recommended, High Quality)' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Fast & Lightweight)' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
  { id: 'allam-2-7b', name: 'Allam 2 7B' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    schedule_cron: '0 */3 * * *',
    timezone: 'Asia/Kolkata',
    posts_per_run: 3,
    max_age_hours: 24,
    groq_model: 'openai/gpt-oss-120b',
    tone: 'magnetic, viral tech copywriting, high-engagement hooks, curiosity gaps, zero fluff',
    brand_hashtags: [],
    use_hacker_news: true,
    require_image: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingLaya, setTestingLaya] = useState(false);
  const [brandTagInput, setBrandTagInput] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        const isStandard = GROQ_MODELS.some((m) => m.id === data.settings.groq_model);
        if (!isStandard) {
          setCustomModelMode(true);
        }
      }
    } catch {
      showNotification('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        showNotification('Settings saved & scheduler updated!');
      } else {
        showNotification(data.error || 'Failed to save settings', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestGroq = async () => {
    try {
      setTestingGroq(true);
      const res = await fetch('/api/settings/test-groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.groq_model }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Groq API Connected! (${data.model} responded OK)`);
      } else {
        showNotification(`Groq Error: ${data.message || 'Connection failed'}`, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingGroq(false);
    }
  };

  const handleTestLaya = async () => {
    try {
      setTestingLaya(true);
      const res = await fetch('/api/settings/test-laya', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('Laya Decision Engine connected & online!');
      } else {
        showNotification(`Laya: ${data.message || 'Connection failed'}`, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setTestingLaya(false);
    }
  };

  const handleAddBrandTag = () => {
    if (!brandTagInput.trim()) return;
    let clean = brandTagInput.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    clean = clean.replace(/[^a-zA-Z0-9_#]/g, '');
    const current = settings.brand_hashtags || [];
    if (!current.includes(clean)) {
      setSettings({ ...settings, brand_hashtags: [...current, clean] });
    }
    setBrandTagInput('');
  };

  const handleRemoveBrandTag = (tag: string) => {
    setSettings({
      ...settings,
      brand_hashtags: (settings.brand_hashtags || []).filter((t) => t !== tag),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RotateCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Toast */}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline & Generation Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure Groq LLM parameters, schedule intervals, tone of voice, and trend scoring rules.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
        >
          {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* Form Cards */}
      <div className="space-y-6">
        {/* 1. Groq Model Configuration */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Groq Model Configuration
            </h3>
            <button
              onClick={handleTestGroq}
              disabled={testingGroq}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5"
            >
              {testingGroq ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Test Groq Connection
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Selected Groq Model</label>
              <button
                type="button"
                onClick={() => setCustomModelMode(!customModelMode)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {customModelMode ? 'Choose from standard models' : 'Enter custom model ID'}
              </button>
            </div>

            {customModelMode ? (
              <input
                type="text"
                value={settings.groq_model}
                onChange={(e) => setSettings({ ...settings, groq_model: e.target.value })}
                placeholder="e.g. llama-3.3-70b-versatile"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            ) : (
              <select
                value={settings.groq_model}
                onChange={(e) => setSettings({ ...settings, groq_model: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 1.5. Laya Decision Model */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> Laya Decision & Virality Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Local decision model (<code className="text-purple-600 dark:text-purple-400 font-mono">convaiinnovations/laya</code>) evaluating news virality & ranking post variations for maximum CTR.
              </p>
            </div>
            <button
              onClick={handleTestLaya}
              disabled={testingLaya}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5"
            >
              {testingLaya ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Test Laya Connection
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-purple-700 dark:text-purple-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Local Server: http://127.0.0.1:8000
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Generates 3 hook variations per story (Curiosity Gap, Industry Shift, High-Impact Insight) and uses Laya as the judge to select the #1 winning tweet.
            </p>
          </div>
        </div>

        {/* 2. Schedule & Timezone */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> Scheduling & Timezone
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Cron Expression
              </label>
              <input
                type="text"
                value={settings.schedule_cron}
                onChange={(e) => setSettings({ ...settings, schedule_cron: e.target.value })}
                placeholder="0 */3 * * *"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400">Default: &quot;0 */3 * * *&quot; (runs every 3 hours)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 3. Pipeline Parameters */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-500" /> Pipeline Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Posts Per Run (Top Stories to Select)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.posts_per_run}
                onChange={(e) => setSettings({ ...settings, posts_per_run: parseInt(e.target.value, 10) || 3 })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Max Story Age (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={settings.max_age_hours}
                onChange={(e) => setSettings({ ...settings, max_age_hours: parseInt(e.target.value, 10) || 24 })}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Tone of Voice (Instruction to Groq)
            </label>
            <input
              type="text"
              value={settings.tone}
              onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
              placeholder="e.g. informative, energetic, slightly witty, no clickbait"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 4. Brand Hashtags & Toggles */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-500" /> Brand Hashtags & Signals
          </h3>

          {/* Brand tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Always-Include Brand Hashtags
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 items-center">
              {(settings.brand_hashtags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-lg text-xs font-semibold"
                >
                  {tag}
                  <button type="button" onClick={() => handleRemoveBrandTag(tag)} className="hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={brandTagInput}
                onChange={(e) => setBrandTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBrandTag())}
                placeholder="Type brand hashtag and press Enter..."
                className="bg-transparent border-none text-xs focus:outline-none flex-1 min-w-[150px]"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                  Hacker News Signal Ingestion
                </span>
                <span className="text-xs text-slate-500">
                  Include Hacker News front-page popularity points into trend ranking.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.use_hacker_news}
                onChange={(e) => setSettings({ ...settings, use_hacker_news: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-slate-400" /> Require Image for Generated Posts
                </span>
                <span className="text-xs text-slate-500">
                  Only produce posts for stories where a valid image is extracted from the article.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.require_image}
                onChange={(e) => setSettings({ ...settings, require_image: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
