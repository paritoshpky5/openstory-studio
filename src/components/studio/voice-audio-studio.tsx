'use client';

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  UserCheck,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Plus,
  Trash2,
  Upload,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface VoiceAudioStudioProps {
  projectId: string;
  project: any;
  onRefresh?: () => void;
}

export function VoiceAudioStudio({ projectId, project, onRefresh }: VoiceAudioStudioProps) {
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('shubh');
  const [testText, setTestText] = useState<string>('महाराजा विक्रमादित्य ने ₹500 का पुरस्कार दिया और धर्म की रक्षा का संकल्प लिया।');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [isAuditionOpen, setIsAuditionOpen] = useState<boolean>(false);

  // Character Casting State
  const [characterVoices, setCharacterVoices] = useState<Record<string, { provider: string; voiceId: string }>>({});
  const [savingCharVoice, setSavingCharVoice] = useState<string | null>(null);

  // Scene Narration State
  const [sceneAudioLoading, setSceneAudioLoading] = useState<Record<string, boolean>>({});
  const [sceneAudioUrls, setSceneAudioUrls] = useState<Record<string, string>>({});
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const [uploadingAudioSceneId, setUploadingAudioSceneId] = useState<string | null>(null);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);
  const [openFreeTtsSceneId, setOpenFreeTtsSceneId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const handleGenerateAllMissing = async () => {
    if (!confirm('Are you sure you want to generate audio for ALL scenes missing active dialogue or narration? This will consume API credits.')) return;
    setIsGeneratingAll(true);
    let generatedCount = 0;
    try {
      for (const scene of project.scenes || []) {
        const textToSpeak = scene.dialogueHindi || scene.narrationHindi;
        if (!textToSpeak) continue;

        const hasActiveAudio = scene.assetVersions?.some((a: any) => (a.assetType === 'DIALOGUE' || a.assetType === 'NARRATION') && a.isActive);
        if (hasActiveAudio) continue;

        // Figure out which voice to use. If character speaks, use their voice, else use first narrator voice.
        let provider = 'sarvam';
        let voiceId = 'shubh';

        if (scene.speakingCharacterId && characterVoices[scene.speakingCharacterId]) {
          provider = characterVoices[scene.speakingCharacterId].provider;
          voiceId = characterVoices[scene.speakingCharacterId].voiceId;
        } else {
          // Find first character voice mapping if any, or default
          const firstChar = Object.keys(characterVoices)[0];
          if (firstChar) {
            provider = characterVoices[firstChar].provider;
            voiceId = characterVoices[firstChar].voiceId;
          }
        }

        const res = await fetch(`/api/projects/${projectId}/audio/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: scene.id,
            characterId: scene.speakingCharacterId || undefined,
            provider: (provider || 'SARVAM').toUpperCase(),
            voiceId,
            text: textToSpeak,
            assetType: scene.dialogueHindi ? 'DIALOGUE' : 'NARRATION',
            settings: { pace: scene.dialogueHindi ? 0.9 : 0.78, temperature: 0.45 },
            forceRegeneration: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let errMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errText;
          } catch {}
          throw new Error(`Scene #${scene.sceneNumber} failed: ${errMsg}`);
        }

        const data = await res.json();
        if (data.success) generatedCount++;
      }

      if (generatedCount > 0) {
        alert(`Successfully generated ${generatedCount} missing audio tracks!`);
        onRefresh?.();
      } else {
        alert('All scenes with text already have active audio tracks.');
      }
    } catch (err: any) {
      alert(`Batch generation error: ${err.message}`);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleCopyText = (sceneId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSceneId(sceneId);
    setTimeout(() => setCopiedSceneId(null), 2500);
  };

  const handleUploadAudio = async (sceneId: string, file: File) => {
    try {
      setUploadingAudioSceneId(sceneId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sceneId', sceneId);
      formData.append('assetType', 'NARRATION');
      formData.append('prompt', `Imported ${file.name} from free web TTS`);

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSceneAudioUrls((prev) => ({
          ...prev,
          [sceneId]: `/api/media/${data.filePath}`,
        }));
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Audio upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Audio upload error');
    } finally {
      setUploadingAudioSceneId(null);
    }
  };

  // Pronunciation Dictionary State
  const [pronunciationRules, setPronunciationRules] = useState<Record<string, string>>({});
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [savingRules, setSavingRules] = useState(false);

  // Audio elements for playback
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const sceneAudioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Fetch available voices
    fetch(`/api/projects/${projectId}/audio/voices`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVoices(data.voices);
        }
      })
      .catch(console.error);

    // Fetch pronunciation dictionary
    fetch(`/api/projects/${projectId}/pronunciation`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.rules) {
          setPronunciationRules(data.rules);
        }
      })
      .catch(console.error);

    // Initialize character voices from project characters
    if (project?.characters) {
      const initial: Record<string, { provider: string; voiceId: string }> = {};
      for (const char of project.characters) {
        initial[char.id] = {
          provider: char.voiceProvider || 'SARVAM',
          voiceId: char.voiceId || 'shubh',
        };
      }
      setCharacterVoices(initial);
    }
  }, [projectId, project]);

  // Handle Voice Audition Preview
  const handleAuditionVoice = async (voiceId: string) => {
    try {
      setSelectedVoice(voiceId);
      setGeneratingPreview(true);
      if (isPlayingPreview && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      }

      const voice = voices.find((v) => v.id === voiceId);
      const res = await fetch(`/api/projects/${projectId}/audio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'NARRATION',
          text: testText,
          provider: voice?.provider || 'SARVAM',
          voiceId: voiceId,
          masterAudio: true,
          forceRegeneration: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.assetVersion) {
        const audioUrl = `/api/media/${data.assetVersion.filePath}`;
        setPreviewAudioUrl(audioUrl);

        if (previewAudioRef.current) {
          previewAudioRef.current.src = audioUrl;
          previewAudioRef.current.play();
          setIsPlayingPreview(true);
        }
      } else {
        alert(data.error || 'Failed to preview voice');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setGeneratingPreview(false);
    }
  };

  // Handle Character Voice Assignment
  const handleAssignVoice = async (characterId: string) => {
    const casting = characterVoices[characterId];
    if (!casting) return;

    try {
      setSavingCharVoice(characterId);
      const res = await fetch(`/api/characters/${characterId}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceProvider: casting.provider,
          voiceId: casting.voiceId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Failed to assign voice');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCharVoice(null);
    }
  };

  // Handle Scene Narration Generation
  const handleGenerateSceneNarration = async (scene: any) => {
    const textToSpeak = scene.narrationHindi || scene.summary;
    if (!textToSpeak) return alert('No narration text found for this scene');

    try {
      setSceneAudioLoading((prev) => ({ ...prev, [scene.id]: true }));
      const res = await fetch(`/api/projects/${projectId}/audio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          assetType: 'NARRATION',
          text: textToSpeak,
          provider: 'SARVAM',
          voiceId: 'shubh',
          settings: { pace: 0.78, temperature: 0.45 },
          masterAudio: true,
          forceRegeneration: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.assetVersion) {
        const url = `/api/media/${data.assetVersion.filePath}`;
        setSceneAudioUrls((prev) => ({ ...prev, [scene.id]: url }));
        if (onRefresh) onRefresh?.();
      } else {
        alert(data.error || 'Failed to generate scene narration');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSceneAudioLoading((prev) => ({ ...prev, [scene.id]: false }));
    }
  };

  // Handle Scene Audio Playback Toggle
  const handlePlaySceneAudio = (sceneId: string, url: string) => {
    if (playingSceneId === sceneId && sceneAudioRef.current) {
      sceneAudioRef.current.pause();
      setPlayingSceneId(null);
    } else if (sceneAudioRef.current) {
      sceneAudioRef.current.src = url;
      sceneAudioRef.current.play();
      setPlayingSceneId(sceneId);
    }
  };

  const handleAdjustAudioSpeed = async (sceneId: string, assetId: string, speedFactor: number) => {
    try {
      setSceneAudioLoading((prev) => ({ ...prev, [sceneId]: true }));
      const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedFactor }),
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || 'Failed to adjust speed');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSceneAudioLoading((prev) => ({ ...prev, [sceneId]: false }));
    }
  };

  // Handle Pronunciation Rule Addition
  const handleAddPronunciationRule = () => {
    if (!newWord.trim() || !newReplacement.trim()) return;
    const updated = { ...pronunciationRules, [newWord.trim()]: newReplacement.trim() };
    setPronunciationRules(updated);
    setNewWord('');
    setNewReplacement('');
    savePronunciationDictionary(updated);
  };

  const handleDeletePronunciationRule = (word: string) => {
    const updated = { ...pronunciationRules };
    delete updated[word];
    setPronunciationRules(updated);
    savePronunciationDictionary(updated);
  };

  const savePronunciationDictionary = async (rules: Record<string, string>) => {
    try {
      setSavingRules(true);
      await fetch(`/api/projects/${projectId}/pronunciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
    } catch (e) {
      console.error('Failed to save pronunciation rules:', e);
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Hidden audio elements */}
      <audio
        ref={previewAudioRef}
        onEnded={() => setIsPlayingPreview(false)}
        className="hidden"
      />
      <audio
        ref={sceneAudioRef}
        onEnded={() => setPlayingSceneId(null)}
        className="hidden"
      />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-amber-400" />
            Hindi Audio & Voice Lab
          </h2>
          <p className="text-xs text-slate-400">
            Native Sarvam AI Bulbul TTS & Multilingual Voice Studio with vocal chain mastering (-16 LUFS).
          </p>
        </div>
        <button
          onClick={handleGenerateAllMissing}
          disabled={isGeneratingAll}
          className="text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {isGeneratingAll ? 'Generating...' : 'Gen All Missing Audio'}
        </button>
      </div>

      {/* SECTION 1: VOICE AUDITION & TESTING (COLLAPSIBLE) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAuditionOpen(!isAuditionOpen)}
          className="w-full p-5 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-white">
              Voice Audition & Blind Comparison
            </h3>
            <span className="text-[11px] text-slate-400 ml-1.5 hidden sm:inline">
              (Sample TTS voices & pronunciation)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hidden sm:inline-block">
              EBU R128 Mastered
            </span>
            <div className="p-1 rounded bg-slate-800 text-slate-300">
              {isAuditionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {isAuditionOpen && (
          <div className="p-6 pt-0 space-y-5 border-t border-slate-800/60 mt-1">
            {/* Audition Prompt Input */}
            <div className="space-y-2 pt-4">
              <label className="text-xs font-semibold text-slate-300">
                Hindi Dialogue / Test Script:
              </label>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                  placeholder="Enter Hindi script with numbers (e.g. ₹1500, 1947) or dialogue..."
                />
              </div>
            </div>

            {/* Available Voice Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {voices.map((voice) => {
                const isAuditioningThis = generatingPreview && selectedVoice === voice.id;
                const isSelected = selectedVoice === voice.id;

                return (
                  <div
                    key={voice.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-amber-500/60 bg-amber-500/5'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{voice.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {voice.provider}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-300 font-medium">
                        {voice.recommendedRole || voice.language}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {voice.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">
                        {voice.gender}
                      </span>
                      <button
                        onClick={() => handleAuditionVoice(voice.id)}
                        disabled={isAuditioningThis}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
                      >
                        {isAuditioningThis ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Synthesizing...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Audition
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: CHARACTER VOICE CASTING */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-amber-400" />
          Character Voice Casting
        </h3>
        <p className="text-xs text-slate-400">
          Assign persistent TTS speaker identities to your recurring character bible.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            const speakingCharacterIds = new Set(project?.scenes?.map((s: any) => s.speakingCharacterId).filter(Boolean));
            const speakingCharacters = project?.characters?.filter((c: any) => speakingCharacterIds.has(c.id)) || [];

            if (speakingCharacters.length === 0) {
              return (
                <div className="col-span-1 md:col-span-2 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs">
                  Solo Storyteller mode is active, or no characters have dialogue lines in the current scenes. All story text will be handled by the Scene Narration Generator below.
                </div>
              );
            }

            return speakingCharacters.map((char: any) => {
              const currentCasting = characterVoices[char.id] || {
                provider: char.voiceProvider || 'SARVAM',
                voiceId: char.voiceId || 'shubh',
              };
              const isSaving = savingCharVoice === char.id;

              return (
                <div
                  key={char.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {char.role}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">{char.name}</h4>
                    </div>
                    {char.voiceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Casted: {char.voiceId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={currentCasting.voiceId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const v = voices.find((item) => item.id === vId);
                        setCharacterVoices((prev) => ({
                          ...prev,
                          [char.id]: {
                            provider: v?.provider || 'SARVAM',
                            voiceId: vId,
                          },
                        }));
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.gender}) — {v.provider}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleAssignVoice(char.id)}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Lock Voice'}
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* SECTION 3: SCENE NARRATION GENERATOR */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Production Scene Narration Takes
        </h3>

        <div className="divide-y divide-slate-800/80">
          {project?.scenes?.map((scene: any) => {
            const isLoading = sceneAudioLoading[scene.id];
            const activeAudio = scene.assetVersions?.find(
              (a: any) => (a.assetType === 'NARRATION' || a.assetType === 'DIALOGUE') && a.isActive
            );
            const audioUrl = sceneAudioUrls[scene.id] || (activeAudio ? `/api/media/${activeAudio.filePath}` : null);
            const isPlayingThis = playingSceneId === scene.id;

            return (
              <div key={scene.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      SHOT #{scene.sceneNumber}
                    </span>
                    <span className="text-xs font-bold text-white">{scene.title}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {scene.durationSeconds}s slot
                    </span>
                  </div>
                  {scene.narrationHindi ? (
                    <p className="text-xs text-amber-200/90 font-serif bg-amber-500/5 p-2 rounded border border-amber-500/10 leading-relaxed">
                      &quot;{scene.narrationHindi}&quot;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No narration text provided for this scene.</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Copy Hindi Text for Web TTS */}
                  {scene.narrationHindi && (
                    <button
                      onClick={() => handleCopyText(scene.id, scene.narrationHindi)}
                      title="Copy Hindi text to paste into Sarvam AI web, ElevenLabs, or Edge-TTS"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                    >
                      {copiedSceneId === scene.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Hindi</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Upload Custom Audio (Free Web Import) */}
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{uploadingAudioSceneId === scene.id ? 'Uploading...' : 'Upload Audio'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={uploadingAudioSceneId === scene.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadAudio(scene.id, file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>

                  {/* Free Quota Web Voice Generators */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenFreeTtsSceneId(openFreeTtsSceneId === scene.id ? null : scene.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-amber-300 hover:bg-slate-800 transition-colors"
                    >
                      <span>Free TTS ↗</span>
                    </button>

                    {openFreeTtsSceneId === scene.id && (
                      <div className="absolute right-0 mt-1 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 space-y-1 font-sans">
                        <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase font-bold border-b border-slate-800">
                          Free Hindi Voice Tools
                        </div>
                        <a
                          href="https://sarvam.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                        >
                          <span className="font-semibold">Sarvam Playground</span>
                          <span className="text-[10px] text-emerald-400 font-mono">Best Hindi</span>
                        </a>
                        <a
                          href="https://elevenlabs.io"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                        >
                          <span className="font-semibold">ElevenLabs Web</span>
                          <span className="text-[10px] text-emerald-400 font-mono">10k Chars Free</span>
                        </a>
                        <a
                          href="https://ttsfree.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                        >
                          <span className="font-semibold">Edge Hindi TTS</span>
                          <span className="text-[10px] text-cyan-400 font-mono">100% Free</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {audioUrl && (
                    <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                      <button
                        onClick={() => handlePlaySceneAudio(scene.id, audioUrl)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                          isPlayingThis
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-transparent text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isPlayingThis ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {isPlayingThis ? 'Pause' : 'Play'}
                      </button>
                      {activeAudio && (
                        <select
                          value={(() => {
                            try {
                              const s = activeAudio.settings ? JSON.parse(activeAudio.settings) : {};
                              return String(s.speedFactor || '1.0');
                            } catch { return '1.0'; }
                          })()}
                          onChange={(e) => {
                            const speed = parseFloat(e.target.value);
                            handleAdjustAudioSpeed(scene.id, activeAudio.id, speed);
                          }}
                          disabled={isLoading}
                          className="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
                          title="Adjust Audio Speed"
                        >
                          <option value="1.0">1.0x</option>
                          <option value="0.9">0.9x</option>
                          <option value="0.8">0.8x</option>
                          <option value="1.1">1.1x</option>
                          <option value="1.2">1.2x</option>
                          <option value="1.25">1.25x</option>
                        </select>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleGenerateSceneNarration(scene)}
                    disabled={isLoading || !scene.narrationHindi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Mastering...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Generate (API)
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: PRONUNCIATION DICTIONARY */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Project Pronunciation Dictionary
            </h3>
            <p className="text-xs text-slate-400">
              Customize Devanagari phonetic replacements for proper nouns and character names.
            </p>
          </div>
          {savingRules && (
            <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Syncing...
            </span>
          )}
        </div>

        {/* Add New Rule Row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Word / Roman Name (e.g. Suryavanshi)"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <input
            type="text"
            placeholder="Hindi Phonics (e.g. सूर्यवंशी)"
            value={newReplacement}
            onChange={(e) => setNewReplacement(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-serif"
          />
          <button
            onClick={handleAddPronunciationRule}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>

        {/* Existing Rules List */}
        <div className="space-y-2">
          {Object.keys(pronunciationRules).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No custom rules added yet. Default system rules (Maharaja, Ayodhya, Gurukul, etc.) apply automatically.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(pronunciationRules).map(([word, rep]) => (
                <div
                  key={word}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="space-x-1.5 truncate">
                    <span className="font-semibold text-slate-300">{word}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-serif text-amber-300">{rep}</span>
                  </div>
                  <button
                    onClick={() => handleDeletePronunciationRule(word)}
                    className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
