// Tests must never contact paid providers, even when the developer shell has API keys.
process.env.OPENSTORY_DEMO_MODE = 'true';
for (const key of [
  'BFL_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'SARVAM_API_KEY',
  'ELEVENLABS_API_KEY', 'KLING_API_KEY', 'KLING_API_SECRET',
  'SEEDANCE_API_KEY', 'ARK_API_KEY', 'SYNCLABS_API_KEY',
]) {
  delete process.env[key];
}
