'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  RotateCw, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Filter
} from 'lucide-react';
import { Run, RunLogEntry } from '@/lib/types';

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/runs?limit=30');
      const data = await res.json();
      if (data.runs) {
        setRuns(data.runs);
        // Expand first run if none expanded
        if (!expandedRunId && data.runs.length > 0) {
          setExpandedRunId(data.runs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  }, [expandedRunId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Polling for active running jobs
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'running');
    let interval: NodeJS.Timeout;
    if (hasRunning) {
      interval = setInterval(() => {
        fetchRuns();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runs, fetchRuns]);

  const toggleExpand = (id: string) => {
    setExpandedRunId(expandedRunId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Success
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin" /> Running
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Partial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-500" /> Failed
          </span>
        );
    }
  };

  const computeDuration = (start: string, finish?: string | null) => {
    if (!finish) return 'In progress...';
    const s = new Date(start).getTime();
    const f = new Date(finish).getTime();
    const sec = Math.max(0, Math.round((f - s) / 1000));
    return `${sec}s`;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline Runs & Observability</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review ingestion execution history, Groq API call traces, and detailed step-by-step logs.
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetchRuns();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 space-y-2">
          <Activity className="w-8 h-8 mx-auto text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">No runs recorded yet</h3>
          <p className="text-xs text-slate-400">Run a pipeline execution from the dashboard to see logs here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id;
            const logEntries: RunLogEntry[] = Array.isArray(run.log) ? run.log : [];
            const filteredLogs = logEntries.filter((l) => logFilter === 'all' || l.level === logFilter);

            return (
              <div
                key={run.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all"
              >
                {/* Run Summary Row */}
                <div
                  onClick={() => toggleExpand(run.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                          #{run.id.slice(0, 8)}
                        </span>
                        {getStatusBadge(run.status)}
                        <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {run.trigger}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Started: {new Date(run.startedAt).toLocaleString()} • Duration: {computeDuration(run.startedAt, run.finishedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-slate-600 dark:text-slate-300 font-medium pl-9 md:pl-0">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Articles Fetched</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{run.articlesFetched}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Posts Created</span>
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{run.postsCreated}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Log Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 p-5 space-y-4">
                    {/* Log Filter Bar */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Filter className="w-3.5 h-3.5" /> Filter Logs:
                        {['all', 'info', 'warn', 'error'].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setLogFilter(lvl as any)}
                            className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-colors ${
                              logFilter === lvl
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      <span className="text-slate-400 font-mono text-[11px]">
                        {filteredLogs.length} events logged
                      </span>
                    </div>

                    {/* Terminal-like log viewer */}
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5 shadow-inner">
                      {filteredLogs.length === 0 ? (
                        <div className="text-slate-500 italic">No logs available for selected filter.</div>
                      ) : (
                        filteredLogs.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-slate-500 shrink-0">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span
                              className={`uppercase text-[10px] px-1.5 py-0.5 rounded shrink-0 font-bold ${
                                entry.level === 'error'
                                  ? 'bg-rose-950 text-rose-400'
                                  : entry.level === 'warn'
                                  ? 'bg-amber-950 text-amber-400'
                                  : 'bg-blue-950 text-blue-400'
                              }`}
                            >
                              {entry.level}
                            </span>
                            <span className="text-slate-400 font-semibold shrink-0">[{entry.step}]</span>
                            <span className="text-slate-200 break-all">{entry.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
