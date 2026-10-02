'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Activity,
  Play,
  EyeOff,
} from 'lucide-react';

function ModelLabContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('projectId') || '';

  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [benchmarkPrompt, setBenchmarkPrompt] = useState('A majestic cinematic portrait of a traditional Indian king standing in a candlelit haveli.');
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState<any>(null);
  
  const [ratings, setRatings] = useState<Record<string, { rating: number; approved: boolean }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/lab/models');
      const data = await res.json();
      if (data.success) {
        setModels(data.models);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const startBenchmark = async () => {
    if (!projectId) return alert('No projectId specified');
    try {
      setRunning(true);
      setSession(null);
      setResultsRevealed(false);
      setRatings({});
      
      const res = await fetch('/api/lab/benchmarks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          jobType: 'IMAGE',
          prompt: benchmarkPrompt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleRating = (assetId: string, rating: number, approved: boolean) => {
    setRatings(prev => ({
      ...prev,
      [assetId]: { rating, approved }
    }));
  };

  const submitRatings = async () => {
    if (!session) return;
    
    // Ensure all rated
    if (Object.keys(ratings).length !== session.candidates.length) {
      return alert('Please rate all candidates before submitting.');
    }

    try {
      setSubmitting(true);
      const payload = Object.entries(ratings).map(([assetId, data]) => ({
        assetId,
        rating: data.rating,
        approved: data.approved,
      }));

      const res = await fetch('/api/lab/benchmarks/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings: payload }),
      });
      
      const data = await res.json();
      if (data.success) {
        setResultsRevealed(true);
        fetchModels(); // Refresh stats
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-200">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={projectId ? `/projects/${projectId}` : '/'}
                className="p-2 rounded-full hover:bg-slate-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                Model Lab & Quality Router
              </h1>
            </div>
            <p className="text-slate-400 text-sm ml-11">
              Blind benchmarking, economic routing analysis, and historical provider performance.
            </p>
          </div>
        </div>

        {/* Global Stats Board */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Model Capability & Economic Router Stats
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-mono font-normal">Model ID</th>
                  <th className="py-3 px-4 font-mono font-normal">Provider</th>
                  <th className="py-3 px-4 font-mono font-normal">Type</th>
                  <th className="py-3 px-4 font-mono font-normal">Win/Approval Rate</th>
                  <th className="py-3 px-4 font-mono font-normal">Generations</th>
                  <th className="py-3 px-4 font-mono font-normal">Avg Cost/Attempt</th>
                  <th className="py-3 px-4 font-mono font-normal text-amber-400">Expected Cost/Success</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const safeRate = Math.max(m.approvalRate, 0.01);
                  const expectedCost = m.effectiveCost > 0 ? (m.effectiveCost / safeRate) : 0;
                  
                  return (
                    <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="py-3 px-4 font-bold text-slate-200">{m.displayName}</td>
                      <td className="py-3 px-4 text-slate-400">{m.provider}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono">{m.type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500" 
                              style={{ width: `${m.approvalRate * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-emerald-400">{(m.approvalRate * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{m.totalGenerations}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        ${m.effectiveCost.toFixed(3)}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-bold">
                        ${expectedCost.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Blind Benchmark Suite */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <EyeOff className="w-5 h-5 text-amber-400" />
              Golden Blind Benchmark
            </h2>
            <select
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              onChange={(e) => setBenchmarkPrompt(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Select a Golden Benchmark Preset...</option>
              <option value="A majestic cinematic portrait of a traditional Indian king standing in a candlelit haveli.">Indian Character Portrait (Hero)</option>
              <option value="A wide cinematic shot of a bustling ancient Indian marketplace at golden hour, dust motes in the air, highly detailed cloth.">Environment & Lighting (Wide)</option>
              <option value="Close up of an expressive old Indian woman wearing traditional jewelry, deeply lined face, looking worried.">Expressive Emotion (Close-up)</option>
              <option value="A stylized 3D rendered shot of a royal durbar with rich colorful silk curtains and physically plausible shadows.">Style & Materials (Medium)</option>
            </select>
          </div>
          
          <div className="flex gap-4">
            <input 
              type="text"
              value={benchmarkPrompt}
              onChange={(e) => setBenchmarkPrompt(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              placeholder="Enter a challenging prompt to benchmark..."
            />
            <button
              onClick={startBenchmark}
              disabled={running || !projectId}
              className="px-6 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {running ? (
                <>Generating...</>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Blind Test
                </>
              )}
            </button>
          </div>

          {session && (
            <div className="space-y-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300">
                  Evaluate Candidates (Names Hidden)
                </h3>
                {!resultsRevealed && (
                  <button
                    onClick={submitRatings}
                    disabled={submitting || Object.keys(ratings).length !== session.candidates.length}
                    className="px-4 py-1.5 rounded-lg font-bold text-xs bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Submit Ratings & Reveal'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {session.candidates.map((candidate: any, index: number) => {
                  const rating = ratings[candidate.assetId];
                  const label = `Candidate ${String.fromCharCode(65 + index)}`; // Candidate A, B, C...

                  return (
                    <div key={candidate.assetId} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                      <div className="aspect-video w-full bg-slate-900 relative">
                        <img 
                          src={`/api/media/${candidate.filePath}`} 
                          className="w-full h-full object-cover" 
                          alt={label} 
                        />
                        {resultsRevealed && (
                          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-slate-700 text-xs font-mono text-cyan-300 font-bold">
                            {candidate.modelId}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-slate-700 text-xs font-bold text-white">
                          {label}
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {!resultsRevealed ? (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleRating(candidate.assetId, 5, true)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                                rating?.approved 
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRating(candidate.assetId, 1, false)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                                rating && !rating.approved 
                                  ? 'bg-red-500/20 border-red-500 text-red-400' 
                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <span className={`text-sm font-bold ${rating?.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                              {rating?.approved ? 'APPROVED' : 'REJECTED'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ModelLabPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Lab...</div>}>
      <ModelLabContent />
    </Suspense>
  );
}
