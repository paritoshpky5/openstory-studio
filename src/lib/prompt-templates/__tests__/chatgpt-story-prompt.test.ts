import { describe, it, expect } from 'vitest';
import { generateChatGPTStoryPrompt } from '../chatgpt-story-prompt';

describe('ChatGPT Story Planning Master Prompt', () => {
  it('generates master prompt containing schema requirements and filmmaking guidelines', () => {
    const prompt = generateChatGPTStoryPrompt();
    expect(prompt).toContain('OpenStory Studio JSON project');
    expect(prompt).toContain('schemaVersion');
    expect(prompt).toContain('CharacterIdentityPackage');
    expect(prompt).toContain('"referenceAssets": []');
    expect(prompt).toContain('Do NOT invent filenames, URLs, or reference IDs');
    expect(prompt).toContain('DEVANAGARI');
    expect(prompt).toContain('DO NOT GENERATE ONE GIANT VIDEO');
  });

  it('embeds user story text when provided', () => {
    const customStory = 'A tale about a boy and an enchanted monsoon cloud';
    const prompt = generateChatGPTStoryPrompt(customStory);
    expect(prompt).toContain(customStory);
  });
});
