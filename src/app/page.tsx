import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import {
  Film,
  Sparkles,
  ArrowRight,
  Users,
  Clapperboard,
  Layers,
  ShieldCheck,
  Palette,
  Volume2,
  Cpu,
  Archive,
} from 'lucide-react';
import { ProjectService } from '@/lib/services/project-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let projects: any[] = [];
  try {
    projects = await ProjectService.listProjects();
  } catch (err) {
    // If DB is not yet migrated, fall back gracefully
    projects = [];
  }

  return (
    <div className="space-y-10 py-4">
      {/* Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
            OpenStory Studio • Open-Source AI Filmmaking
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            High-Quality Stylized 3D Animated Stories with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">
              Strict Character Consistency
            </span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Local-first AI filmmaking pipeline. Started with authentic Hindi storytelling and Stylized 3D Animation, with upcoming expansions to regional Indian &amp; global languages (Tamil, Telugu, Bengali, Marathi, English) and diverse visual styles (Anime, 2D Classic, Watercolor).
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Start New Story Project
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-all"
            >
              <Cpu className="w-4 h-4 text-cyan-400" />
              Model Lab & Benchmarks
            </Link>
          </div>
        </div>

        {/* Decorative background grid pattern */}
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Production Pipeline Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-amber-400">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded">STEP 1-3</span>
          </div>
          <h3 className="font-bold text-sm text-slate-100">Character & Style Lock</h3>
          <p className="text-xs text-slate-400 leading-normal">
            Detailed Indian character traits & textures. Approved faces and clothing locked before expensive generation.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-cyan-400">
            <Palette className="w-5 h-5" />
            <span className="text-[10px] font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded">STEP 4-6</span>
          </div>
          <h3 className="font-bold text-sm text-slate-100">Approved Frame to Video</h3>
          <p className="text-xs text-slate-400 leading-normal">
            Prompt compiler builds provider-specific prompts. Image-to-video ensures continuity across recurring characters.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-emerald-400">
            <Volume2 className="w-5 h-5" />
            <span className="text-[10px] font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">STEP 7-9</span>
          </div>
          <h3 className="font-bold text-sm text-slate-100">Natural Hindi Voice Lab</h3>
          <p className="text-xs text-slate-400 leading-normal">
            Sarvam & ElevenLabs Devanagari TTS, pronunciation dictionary, sound effects, ambience, and music ducking.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-violet-400">
            <Film className="w-5 h-5" />
            <span className="text-[10px] font-mono font-bold bg-violet-500/10 px-2 py-0.5 rounded">STEP 10</span>
          </div>
          <h3 className="font-bold text-sm text-slate-100">Deterministic FFmpeg</h3>
          <p className="text-xs text-slate-400 leading-normal">
            Multi-track timeline audio mixing, resolution normalization, subtitle burns, and final 1080p/4K master export.
          </p>
        </div>
      </div>

      {/* Projects List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Your Production Projects</h2>
            <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/projects/new?tab=zip"
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              Restore ZIP Backup
            </Link>
            <Link
              href="/projects/new"
              className="text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-colors"
            >
              + Create / Import
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Clapperboard className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-200">No story projects yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Ready to produce your first Hindi cinematic film? Copy the ChatGPT Story Planning prompt,
                paste your story, and import the resulting JSON in seconds.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Import OpenStory JSON
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 hover:border-amber-500/40 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {p.aspectRatio} • {p.fps}fps
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {p.currentPhase.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {p._count?.characters || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clapperboard className="w-3.5 h-3.5 text-slate-500" />
                      {p._count?.scenes || 0} shots
                    </span>
                  </div>
                  <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold text-[11px]">
                    Open Studio →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
