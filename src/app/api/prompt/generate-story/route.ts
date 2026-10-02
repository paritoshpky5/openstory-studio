import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateChatGPTStoryPrompt } from '@/lib/prompt-templates/chatgpt-story-prompt';
import { validateStoryFlowJson } from '@/schemas/storyflow.schema';
import { ProjectService } from '@/lib/services/project-service';

function getStoredKey(keyName: string): string {
  // Check process.env first
  if (process.env[keyName]) return process.env[keyName]!;

  // Check data/settings.json
  const settingsPath = path.join(process.cwd(), 'data', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (data.keys && data.keys[keyName]) {
        return data.keys[keyName];
      }
    } catch {
      // ignore
    }
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      storyText,
      narrationMode,
      narratorTone,
      provider = 'openai',
      model,
      apiKey: customApiKey,
    } = body;

    // 1. Compile the master filmmaking prompt
    const masterPrompt = generateChatGPTStoryPrompt({
      userStoryText: storyText,
      narrationMode,
      narratorTone,
    });

    // 2. Resolve API key
    let resolvedKey = (customApiKey || '').trim();
    if (!resolvedKey) {
      if (provider === 'openai') resolvedKey = getStoredKey('OPENAI_API_KEY');
      else if (provider === 'anthropic') resolvedKey = getStoredKey('ANTHROPIC_API_KEY');
      else if (provider === 'gemini') resolvedKey = getStoredKey('GEMINI_API_KEY');
      else if (provider === 'openrouter') resolvedKey = getStoredKey('OPENROUTER_API_KEY');
    }

    if (!resolvedKey) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing API key for ${provider.toUpperCase()}. Please provide your key or configure it in Settings.`,
        },
        { status: 400 }
      );
    }

    let rawJsonText = '';

    // 3. Dispatch to selected LLM provider
    if (provider === 'openai') {
      const selectedModel = model || 'gpt-4o';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolvedKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a master cinematic film director and AI animation screenwriter. Return ONLY valid JSON adhering to the specified schemaVersion "1.0.0". Do not wrap in conversational markdown.',
            },
            {
              role: 'user',
              content: masterPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenAI API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      rawJsonText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const selectedModel = model || 'claude-3-5-sonnet-20241022';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 8192,
          system:
            'You are a master cinematic film director and AI animation screenwriter. Return ONLY valid JSON adhering to the specified schemaVersion "1.0.0". Do not wrap in conversational text.',
          messages: [
            {
              role: 'user',
              content: masterPrompt,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Anthropic API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      rawJsonText = data.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const selectedModel = model || 'gemini-1.5-pro';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${resolvedKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: masterPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Gemini API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'openrouter') {
      const selectedModel = model || 'anthropic/claude-3.5-sonnet';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolvedKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'OpenStory Studio',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a master cinematic film director and AI animation screenwriter. Return ONLY valid JSON adhering to the specified schemaVersion "1.0.0".',
            },
            {
              role: 'user',
              content: masterPrompt,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenRouter API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      rawJsonText = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    if (!rawJsonText) {
      throw new Error('Received empty response from the AI model.');
    }

    // 4. Sanitize and parse JSON
    let clean = rawJsonText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr: any) {
      throw new Error(`Model returned invalid JSON format: ${parseErr.message}`);
    }

    // 5. Validate schema
    const validation = validateStoryFlowJson(parsed);
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generated story failed schema validation',
          details: validation.errors,
          rawResponse: clean.slice(0, 500),
        },
        { status: 422 }
      );
    }

    // 6. Import directly into SQLite database & local storage
    const createdProject = await ProjectService.importProject(validation.data);

    return NextResponse.json({
      success: true,
      projectId: createdProject.id,
      project: createdProject,
      message: `Story "${createdProject.name}" successfully generated and imported!`,
    });
  } catch (error: any) {
    console.error('[Generate Story API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-generate story' },
      { status: 500 }
    );
  }
}
