'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

type Provider = 'LOCAL' | 'AUTO' | 'GEMINI' | 'OLLAMA';

interface Finding {
  id: string;
  severity: 'BLOCKER' | 'WARNING' | 'INFO';
  stage: string;
  title: string;
  detail: string;
  suggestedAction: string;
  sceneNumber?: number;
}

interface PromptAudit {
  id: string;
  scope: 'STYLE' | 'CHARACTER' | 'SCENE';
  label: string;
  sceneNumber?: number;
  status: 'PASS' | 'IMPROVE' | 'MISSING';
  issues: string[];
  enhancedPositivePrompt?: string;
  enhancedNegativePrompt?: string;
  enhancedMotionPrompt?: string;
  enhancedNegativeMotionPrompt?: string;
}

interface SceneReview {
  sceneNumber: number;
  score: number;
  verdict: 'PASS' | 'FIX' | 'REGENERATE';
  issues: string[];
  recommendedAction: string;
  regenerationPrompt: string;
}

interface Report {
  generatedAt: string;
  providerUsed: 'LOCAL' | 'GEMINI' | 'OLLAMA';
  model?: string;
  score: number;
  exportReady: boolean;
  summary: string;
  findings: Finding[];
  sceneReviews: SceneReview[];
  promptAudits: PromptAudit[];
  nextActions: string[];
}

const providerHelp: Record<Provider, string> = {
  LOCAL: 'Free, private technical and prompt audit. No media leaves this device.',
  AUTO: 'Uses Gemini Vision when configured; otherwise runs locally.',
  GEMINI: 'Sends one sampled frame per scene plus prompt metadata to Google Gemini.',
  OLLAMA: 'Uses the local Ollama vision model configured on this computer.',
};

export function AIDirectorPanel({ projectId }: { projectId: string }) {
  const [provider, setProvider] = useState<Provider>('LOCAL');
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/quality-review`)
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return payload.report || null;
      })
      .then(setReport)
      .catch(() => undefined);
  }, [projectId]);

  const counts = useMemo(() => ({
    blockers: report?.findings.filter((finding) => finding.severity === 'BLOCKER').length || 0,
    warnings: report?.findings.filter((finding) => finding.severity === 'WARNING').length || 0,
    prompts: report?.promptAudits.filter((audit) => audit.status !== 'PASS').length || 0,
  }), [report]);

  const runReview = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/quality-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || 'AI Director review failed.');
      setReport(payload.report);
    } catch (reviewError: any) {
      setError(reviewError.message || 'AI Director review failed.');
    } finally {
      setRunning(false);
    }
  };

  const copyPrompt = async (audit: PromptAudit) => {
    const text = [
      audit.enhancedPositivePrompt && `POSITIVE PROMPT\n${audit.enhancedPositivePrompt}`,
      audit.enhancedNegativePrompt && `NEGATIVE PROMPT\n${audit.enhancedNegativePrompt}`,
      audit.enhancedMotionPrompt && `MOTION PROMPT\n${audit.enhancedMotionPrompt}`,
      audit.enhancedNegativeMotionPrompt && `NEGATIVE MOTION PROMPT\n${audit.enhancedNegativeMotionPrompt}`,
    ].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(audit.id);
    setTimeout(() => setCopied((value) => value === audit.id ? null : value), 1800);
  };

  return (
    <section className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/35 to-slate-950/60 p-5 space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-300" />
            <h3 className="font-bold text-white">AI Director Quality Loop</h3>
            <span className="text-[10px] uppercase tracking-wider text-violet-300 border border-violet-500/30 rounded px-2 py-0.5">Human approval required</span>
          </div>
          <p className="text-xs text-slate-400">
            Audits continuity, prompt reproducibility, pacing, coverage, media durations, and delivery readiness. It recommends corrections but never regenerates paid media automatically.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
          <div>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              <option value="LOCAL">Local technical + prompt audit</option>
              <option value="OLLAMA">Ollama Vision (local)</option>
              <option value="GEMINI">Gemini Vision (cloud)</option>
              <option value="AUTO">Auto provider</option>
            </select>
            <p className="mt-1 max-w-64 text-[10px] leading-relaxed text-slate-500">{providerHelp[provider]}</p>
          </div>
          <button
            onClick={runReview}
            disabled={running}
            className="h-9 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {running ? 'Reviewing…' : 'Run quality review'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          <XCircle className="mt-0.5 w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!report && !error && (
        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
          Run the local audit before export. Add Gemini or Ollama when you want visual continuity review of sampled scene frames.
        </div>
      )}

      {report && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Metric label="Quality" value={`${report.score}/100`} tone={report.score >= 80 ? 'green' : report.score >= 60 ? 'amber' : 'red'} />
            <Metric label="Export gate" value={report.exportReady ? 'Ready' : 'Blocked'} tone={report.exportReady ? 'green' : 'red'} />
            <Metric label="Blockers" value={String(counts.blockers)} tone={counts.blockers ? 'red' : 'green'} />
            <Metric label="Warnings" value={String(counts.warnings)} tone={counts.warnings ? 'amber' : 'green'} />
            <Metric label="Prompt fixes" value={String(counts.prompts)} tone={counts.prompts ? 'amber' : 'green'} />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            {report.exportReady ? <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
            <div>
              <p className="text-sm text-slate-200">{report.summary}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {report.providerUsed}{report.model ? ` · ${report.model}` : ''} · {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {report.findings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Production gates</h4>
              {report.findings
                .filter((finding) => finding.severity === 'BLOCKER')
                .map((finding) => <FindingCard key={finding.id} finding={finding} />)}
              {report.findings.some((finding) => finding.severity !== 'BLOCKER') && (
                <details className="rounded-lg border border-slate-800 bg-slate-950/30">
                  <summary className="cursor-pointer list-none p-3 text-xs font-semibold text-slate-300">
                    Show {report.findings.filter((finding) => finding.severity !== 'BLOCKER').length} warnings and mix notes
                  </summary>
                  <div className="border-t border-slate-800 p-3 space-y-2">
                    {report.findings
                      .filter((finding) => finding.severity !== 'BLOCKER')
                      .map((finding) => <FindingCard key={finding.id} finding={finding} />)}
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Prompt audit</h4>
                <p className="text-[10px] text-slate-500">Enhanced prompts are suggestions; copy and approve them before regeneration.</p>
              </div>
            </div>
            {report.promptAudits?.map((audit) => (
              <details key={audit.id} className="group rounded-lg border border-slate-800 bg-slate-950/45">
                <summary className="cursor-pointer list-none flex items-center gap-2 p-3 text-xs">
                  {audit.status === 'PASS' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  <span className="font-semibold text-slate-200">{audit.label}</span>
                  <span className="text-[9px] text-slate-500">{audit.scope}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{audit.status}</span>
                </summary>
                <div className="border-t border-slate-800 p-3 space-y-3">
                  {audit.issues.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-amber-200/80">
                      {audit.issues.map((issue) => <li key={issue}>• {issue}</li>)}
                    </ul>
                  )}
                  <div className="grid lg:grid-cols-2 gap-3">
                    {audit.enhancedPositivePrompt && <PromptBox title="Enhanced image / identity prompt" text={audit.enhancedPositivePrompt} />}
                    {audit.enhancedMotionPrompt && <PromptBox title="Enhanced motion prompt" text={audit.enhancedMotionPrompt} />}
                  </div>
                  <button
                    onClick={() => copyPrompt(audit)}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-violet-500/50"
                  >
                    {copied === audit.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === audit.id ? 'Copied' : 'Copy complete prompt pack'}
                  </button>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'red' }) {
  const tones = {
    green: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-300',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-[9px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
      <div className="flex items-center gap-2 text-xs">
        {finding.severity === 'BLOCKER' ? <XCircle className="w-4 h-4 text-red-400" /> : finding.severity === 'WARNING' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-cyan-400" />}
        <span className="font-semibold text-slate-200">{finding.title}</span>
        <span className="ml-auto text-[9px] text-slate-500">{finding.stage}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{finding.detail}</p>
      <p className="mt-1 text-[11px] text-slate-300">Next: {finding.suggestedAction}</p>
    </div>
  );
}

function PromptBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-black/25 p-3">
      <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">{title}</p>
      <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}
