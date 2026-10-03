'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Sliders,
  Upload,
  Zap,
} from 'lucide-react';
import { resolveWorkflowMode, type WorkflowMode } from '@/lib/settings/workflow-mode';

interface KeyConfig {
  key: string;
  name: string;
  category: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'LIPSYNC';
  description: string;
  portalUrl: string;
  pricingHint: string;
}

const API_KEYS_LIST: KeyConfig[] = [
  // AUDIO / VOICE
  {
    key: 'SARVAM_API_KEY',
    name: 'Sarvam AI API Key',
    category: 'AUDIO',
    description: 'Specialized in Indian language TTS (bulbul:v3). Highly recommended for natural Hindi accents.',
    portalUrl: 'https://sarvam.ai',
    pricingHint: 'Pay-as-you-go (~₹0.20 per min of speech). Signup trial credits available.',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    name: 'ElevenLabs API Key',
    category: 'AUDIO',
    description: 'High quality multilingual narration (eleven_multilingual_v2).',
    portalUrl: 'https://elevenlabs.io',
    pricingHint: 'Free tier includes 10,000 chars/mo. Paid tiers available.',
  },

  // IMAGE MODELS
  {
    key: 'GEMINI_API_KEY',
    name: 'Google AI Studio (Gemini Image)',
    category: 'IMAGE',
    description: 'Used for cinematic Indian character compositions and storyboard generation.',
    portalUrl: 'https://aistudio.google.com',
    pricingHint: 'Generous free tier. Extremely cost-effective.',
  },
  {
    key: 'BFL_API_KEY',
    name: 'Black Forest Labs (FLUX.1)',
    category: 'IMAGE',
    description: 'High-detail consistent Indian character references and production frames.',
    portalUrl: 'https://blackforestlabs.ai',
    pricingHint: 'Pay per generation (~$0.02 - $0.04/image).',
  },
  {
    key: 'OPENAI_API_KEY',
    name: 'OpenAI API Key (GPT Image)',
    category: 'IMAGE',
    description: 'Hero frames and prompt-faithful compositions.',
    portalUrl: 'https://platform.openai.com',
    pricingHint: 'Pay-as-you-go (~$0.04/image).',
  },

  // VIDEO MODELS
  {
    key: 'KLING_API_KEY',
    name: 'Kling AI Access Key',
    category: 'VIDEO',
    description: 'Cinematic image-to-video with camera motion and lighting.',
    portalUrl: 'https://klingai.com',
    pricingHint: 'API credit wallet or use Kling web with 66 free daily credits.',
  },
  {
    key: 'KLING_API_SECRET',
    name: 'Kling AI Secret Key',
    category: 'VIDEO',
    description: 'Required if using Kling AI direct enterprise API authentication.',
    portalUrl: 'https://klingai.com',
    pricingHint: 'Paired with Kling Access Key.',
  },
  {
    key: 'SEEDANCE_API_KEY',
    name: 'Seedance / ByteDance Key',
    category: 'VIDEO',
    description: 'Acting, multi-character dynamics, and expressive motion.',
    portalUrl: 'https://volcengine.com',
    pricingHint: 'Pay-as-you-go video tokens.',
  },

  // LIP SYNC
  {
    key: 'SYNCLABS_API_KEY',
    name: 'SyncLabs API Key',
    category: 'LIPSYNC',
    description: 'Video mouth sync to Hindi dialogue tracks. (Local FFmpeg fallback is active if omitted).',
    portalUrl: 'https://synclabs.so',
    pricingHint: '$5 test credits on signup.',
  },
];

export function SettingsStudio() {
  const [settingsStatus, setSettingsStatus] = useState<Record<string, { configured: boolean; preview: string }>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [defaultWorkflow, setDefaultWorkflow] = useState<WorkflowMode>('HYBRID');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettingsStatus(data.settings);
        setDefaultWorkflow(resolveWorkflowMode(data.defaultWorkflow));
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      setSaveError(null);

      // Only send keys that the user actively typed into
      const payloadKeys: Record<string, string> = {};
      for (const [k, v] of Object.entries(inputValues)) {
        payloadKeys[k] = v;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keys: payloadKeys,
          defaultWorkflow,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setInputValues({}); // Clear inputs after saving
        await fetchSettings();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error || 'Failed to save settings');
      }
    } catch (e: any) {
      setSaveError(e.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const renderCategory = (category: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'LIPSYNC', title: string, icon: any) => {
    const Icon = icon;
    const items = API_KEYS_LIST.filter(k => k.category === category);

    return (
      <div className="space-y-4">
        <h4 className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-2 border-b border-slate-800 pb-2">
          <Icon className="w-4 h-4 text-amber-400" />
          {title}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => {
            const status = settingsStatus[item.key] || { configured: false, preview: '' };
            const isConfigured = status.configured;
            const isVisible = showKeys[item.key] || false;
            const hasInputValue = inputValues[item.key] !== undefined && inputValues[item.key] !== '';

            return (
              <div
                key={item.key}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {item.name}
                    </span>
                    {isConfigured ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        API Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {defaultWorkflow === 'DIRECT_API' ? 'Key required' : 'Free Web / Mock'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {item.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      value={inputValues[item.key] ?? (isConfigured ? status.preview : '')}
                      onChange={(e) => handleInputChange(item.key, e.target.value)}
                      placeholder={isConfigured ? 'Leave unchanged or enter new key' : 'Enter API key (Optional)...'}
                      className={`w-full bg-slate-900 border rounded-lg px-3 py-2 pr-9 text-xs font-mono transition-colors focus:outline-none ${
                        hasInputValue
                          ? 'border-amber-500 text-white'
                          : isConfigured
                          ? 'border-emerald-500/40 text-emerald-200'
                          : 'border-slate-800 text-slate-300 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey(item.key)}
                      className="absolute right-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="truncate max-w-[200px]" title={item.pricingHint}>{item.pricingHint}</span>
                    <a
                      href={item.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5 shrink-0"
                    >
                      Get Key
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            API & Workflow
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Select how the studio should generate assets, then add only the API keys that workflow needs.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50 shrink-0 shadow-lg shadow-amber-500/10"
        >
          {saving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Saving Keys...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
              Saved Successfully!
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          {saveError}
        </div>
      )}

      {/* WORKFLOW PREFERENCE SELECTOR */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <h3 className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Default Generation Workflow Mode
        </h3>
        <p className="text-xs text-slate-400">
          Direct API keeps the studio automated and hides manual prompt, web-tool, and upload controls.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => setDefaultWorkflow('FREE_WEB')}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              defaultWorkflow === 'FREE_WEB'
                ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Free Web Mode ($0 Spend)
              </span>
              <p className="text-[11px] text-slate-400">
                Prioritizes 1-click &quot;Copy Prompt&quot; and &quot;Upload Asset&quot; buttons for Kling, ImageFX, and Sarvam web.
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono mt-3">Zero API tokens needed</span>
          </button>

          <button
            onClick={() => setDefaultWorkflow('DIRECT_API')}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              defaultWorkflow === 'DIRECT_API'
                ? 'bg-amber-950/40 border-amber-500/50 shadow-sm'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Direct API Mode (Automated)
              </span>
              <p className="text-[11px] text-slate-400">
                Clean one-click generation with prompts compiled automatically behind the scenes.
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-mono mt-3">Requires funded API keys</span>
          </button>

          <button
            onClick={() => setDefaultWorkflow('HYBRID')}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              defaultWorkflow === 'HYBRID'
                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Hybrid Mode
              </span>
              <p className="text-[11px] text-slate-400">
                Displays both Copy & Upload alongside Direct API buttons on every shot.
              </p>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono mt-3">Maximum flexibility</span>
          </button>
        </div>
      </div>

      {/* KEY SECTIONS */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          Loading saved settings...
        </div>
      ) : (
        <div className="space-y-8">
          {renderCategory('AUDIO', 'Hindi Voice & Audio Models (Recommended)', Sliders)}
          {renderCategory('IMAGE', 'Character & Storyboard Image Models', Sparkles)}
          {renderCategory('VIDEO', 'Video Animation Models', Zap)}
          {renderCategory('LIPSYNC', 'Lip Sync Models', Key)}
        </div>
      )}
    </div>
  );
}
