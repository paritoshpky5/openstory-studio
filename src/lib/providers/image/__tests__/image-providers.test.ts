import { describe, it, expect } from 'vitest';
import { FluxProvider } from '../flux-provider';
import { GeminiImageProvider } from '../gemini-provider';
import { OpenAIImageProvider } from '../openai-provider';
import { getImageProvider } from '../index';

describe('Image Providers Unit Tests', () => {
  it('correctly maps provider names in factory', () => {
    expect(getImageProvider('FLUX')).toBeInstanceOf(FluxProvider);
    expect(getImageProvider('GEMINI')).toBeInstanceOf(GeminiImageProvider);
    expect(getImageProvider('OPENAI')).toBeInstanceOf(OpenAIImageProvider);
  });

  describe('FluxProvider', () => {
    const provider = new FluxProvider('mock');

    it('estimates cost accurately', () => {
      expect(provider.estimateCost('flux-1-schnell', {})).toBe(0.003);
      expect(provider.estimateCost('flux-1-dev', {})).toBe(0.03);
      expect(provider.estimateCost('flux-1-pro', {})).toBe(0.05);
    });

    it('generates mock preview buffer in test mode', async () => {
      const res = await provider.generateImage(
        'flux-1-dev',
        'A cinematic shot of Raja Mohan in royal haveli courtyard',
        undefined,
        { aspectRatio: '16:9' }
      );
      expect(res.buffer).toBeDefined();
      expect(res.buffer?.length).toBeGreaterThan(100);
      expect(res.buffer?.toString()).toContain('<svg');
      expect(res.buffer?.toString()).toContain('Raja Mohan');
    });
  });

  describe('GeminiImageProvider', () => {
    const provider = new GeminiImageProvider('mock');

    it('estimates cost accurately', () => {
      expect(provider.estimateCost('imagen-3.0-generate-001', {})).toBe(0.03);
    });

    it('generates mock preview buffer in test mode', async () => {
      const res = await provider.generateImage(
        'imagen-3.0-generate-001',
        'Indian temple street at golden hour, detailed stylized 3D',
        undefined,
        { aspectRatio: '16:9' }
      );
      expect(res.buffer).toBeDefined();
      expect(res.buffer?.toString()).toContain('<svg');
      expect(res.buffer?.toString()).toContain('Indian temple street');
    });
  });

  describe('OpenAIImageProvider', () => {
    const provider = new OpenAIImageProvider('mock');

    it('estimates cost accurately with standard vs hd', () => {
      expect(provider.estimateCost('dall-e-3', { quality: 'standard' })).toBe(0.04);
      expect(provider.estimateCost('dall-e-3', { quality: 'hd' })).toBe(0.08);
    });

    it('generates mock preview buffer in test mode', async () => {
      const res = await provider.generateImage(
        'dall-e-3',
        'Expressive Hindi animated film portrait, vibrant colors',
        undefined,
        { aspectRatio: '16:9' }
      );
      expect(res.buffer).toBeDefined();
      expect(res.buffer?.toString()).toContain('<svg');
    });
  });
});
