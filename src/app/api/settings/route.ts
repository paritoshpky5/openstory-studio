import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { normalizeWorkflowMode, resolveWorkflowMode } from '@/lib/settings/workflow-mode';

const SUPPORTED_KEYS = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI (Story & GPT Image)', category: 'LLM & IMAGE' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic (Claude)', category: 'LLM' },
  { key: 'GEMINI_API_KEY', label: 'Google AI Studio (Gemini 1.5 Pro & Imagen)', category: 'LLM & IMAGE' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter (Multi-LLM Gateway)', category: 'LLM' },
  { key: 'BFL_API_KEY', label: 'Black Forest Labs (Flux)', category: 'IMAGE' },
  { key: 'KLING_API_KEY', label: 'Kling AI Access Key', category: 'VIDEO' },
  { key: 'KLING_API_SECRET', label: 'Kling AI Secret Key', category: 'VIDEO' },
  { key: 'SEEDANCE_API_KEY', label: 'Seedance / ByteDance Key', category: 'VIDEO' },
  { key: 'SARVAM_API_KEY', label: 'Sarvam AI (Native Hindi TTS)', category: 'AUDIO' },
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs Multilingual', category: 'AUDIO' },
  { key: 'SYNCLABS_API_KEY', label: 'SyncLabs Lip Sync', category: 'LIPSYNC' },
];
const SUPPORTED_KEY_NAMES = new Set(SUPPORTED_KEYS.map((item) => item.key));

function getSettingsFilePath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'settings.json');
}

function loadSavedSettings(): { keys: Record<string, string>; defaultWorkflow?: string } {
  const filePath = getSettingsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { keys: {} };
    }
  }
  return { keys: {} };
}

function syncToEnvFile(updatedKeys: Record<string, string>, clearedKeys: string[] = []) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  let lines = envContent.split(/\r?\n/);
  
  // Update or append active keys
  for (const [key, value] of Object.entries(updatedKeys)) {
    if (value === undefined) continue;
    // Sanitize key and value against newlines or quote injections
    const sanitizedKey = key.replace(/[^A-Z0-9_]/gi, '');
    const sanitizedValue = value.replace(/[\r\n"]/g, '');
    let found = false;
    lines = lines.map(line => {
      if (line.startsWith(`${sanitizedKey}=`)) {
        found = true;
        return `${sanitizedKey}="${sanitizedValue}"`;
      }
      return line;
    });
    if (!found) {
      lines.push(`${sanitizedKey}="${sanitizedValue}"`);
    }
  }

  // Clear removed keys in .env
  for (const key of clearedKeys) {
    const sanitizedKey = key.replace(/[^A-Z0-9_]/gi, '');
    lines = lines.map(line => {
      if (line.startsWith(`${sanitizedKey}=`)) {
        return `${sanitizedKey}=""`;
      }
      return line;
    });
  }

  fs.writeFileSync(envPath, lines.join('\n'));
}

export async function GET() {
  try {
    const saved = loadSavedSettings();
    const result: Record<string, { configured: boolean; preview: string; label: string; category: string }> = {};

    for (const item of SUPPORTED_KEYS) {
      // Check process.env first, then saved settings
      const val = process.env[item.key] || saved.keys[item.key] || '';
      const isConfigured = val.trim().length > 0;
      let preview = '';
      if (isConfigured) {
        if (val.length <= 8) {
          preview = '••••••••';
        } else {
          preview = `${val.slice(0, 4)}••••${val.slice(-4)}`;
        }
      }

      result[item.key] = {
        configured: isConfigured,
        preview,
        label: item.label,
        category: item.category,
      };
    }

    return NextResponse.json({
      success: true,
      settings: result,
      defaultWorkflow: resolveWorkflowMode(saved.defaultWorkflow),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incomingKeys: Record<string, unknown> = body.keys || {};
    const defaultWorkflow = normalizeWorkflowMode(body.defaultWorkflow ?? 'HYBRID');
    if (!defaultWorkflow) {
      return NextResponse.json({ success: false, error: 'Unsupported default workflow' }, { status: 400 });
    }

    const unsupportedKeys = Object.keys(incomingKeys).filter((key) => !SUPPORTED_KEY_NAMES.has(key));
    if (unsupportedKeys.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unsupported settings key: ${unsupportedKeys.join(', ')}` },
        { status: 400 }
      );
    }

    const saved = loadSavedSettings();
    const updatedKeys = { ...saved.keys };
    const clearedKeys: string[] = [];

    for (const [key, val] of Object.entries(incomingKeys)) {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.length > 0) {
          updatedKeys[key] = trimmed;
          process.env[key] = trimmed; // Update in memory immediately
        } else if (val === '') {
          // Explicitly cleared
          clearedKeys.push(key);
          delete updatedKeys[key];
          delete process.env[key];
        }
      }
    }

    // Persist to data/settings.json
    const filePath = getSettingsFilePath();
    fs.writeFileSync(
      filePath,
      JSON.stringify({ keys: updatedKeys, defaultWorkflow, updatedAt: new Date().toISOString() }, null, 2)
    );

    // Sync to .env for persistence across restarts
    syncToEnvFile(updatedKeys, clearedKeys);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    console.error('[Settings API] Error updating settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
