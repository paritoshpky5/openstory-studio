import { describe, it, expect } from 'vitest';
import { SubtitleGenerator } from '@/lib/subtitles/subtitle-generator';
import { AudioDuckingEngine, SpeechSegment } from '../audio-ducking';
import { SyncLabsLipSyncProvider } from '@/lib/providers/lipsync/synclabs-provider';

describe('Sound Design, Ducking & Subtitles', () => {
  describe('SubtitleGenerator', () => {
    it('formats SRT and VTT timestamps with millisecond accuracy', () => {
      // 1 hour, 2 minutes, 3.456 seconds
      const seconds = 3600 + 120 + 3.456;
      expect(SubtitleGenerator.formatSrtTimestamp(seconds)).toBe('01:02:03,456');
      expect(SubtitleGenerator.formatVttTimestamp(seconds)).toBe('01:02:03.456');
    });

    it('wraps long Devanagari sentences cleanly into maximum 2 lines', () => {
      const longSentence = 'राजा विक्रमादित्य ने अपने विशाल दरबार में उपस्थित सभी मंत्रियों और प्रजाजनों को संबोधित करते हुए न्याय का संदेश दिया।';
      const wrapped = SubtitleGenerator.wrapSubtitleText(longSentence, 35);
      const lines = wrapped.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines[0].length).toBeLessThanOrEqual(50);
    });

    it('generates standard SRT content structure', () => {
      const cues = [
        {
          index: 1,
          startSeconds: 0.0,
          endSeconds: 4.5,
          textHindi: 'एक समय की बात है, राजा राज्य करता था।',
        },
        {
          index: 2,
          startSeconds: 4.5,
          endSeconds: 9.0,
          textHindi: 'उसकी प्रजा बहुत प्रसन्न थी।',
        },
      ];

      const srt = SubtitleGenerator.generateSrt(cues);
      expect(srt).toContain('1\n00:00:00,000 --> 00:00:04,500');
      expect(srt).toContain('2\n00:00:04,500 --> 00:00:09,000');
      expect(srt).toContain('एक समय की बात है');
    });

    it('generates standard WebVTT content starting with WEBVTT header', () => {
      const cues = [
        {
          index: 1,
          startSeconds: 1.0,
          endSeconds: 3.5,
          textHindi: 'नमस्ते भारत!',
        },
      ];

      const vtt = SubtitleGenerator.generateVtt(cues);
      expect(vtt.startsWith('WEBVTT')).toBe(true);
      expect(vtt).toContain('00:00:01.000 --> 00:00:03.500');
      expect(vtt).toContain('नमस्ते भारत!');
    });
  });

  describe('AudioDuckingEngine', () => {
    it('builds an FFmpeg volume filter expression with merged speech windows', () => {
      const segments: SpeechSegment[] = [
        { startSeconds: 2.0, endSeconds: 5.0 },
        { startSeconds: 8.0, endSeconds: 12.0 },
      ];

      const filter = AudioDuckingEngine.buildDuckingFilterExpression(segments, {
        normalGain: 1.0,
        duckedGain: 0.2,
      });

      expect(filter).toContain("volume='if(");
      expect(filter).toContain('between(t,');
      expect(filter).toContain('0.2,1)');
    });

    it('returns standard volume expression when no speech segments exist', () => {
      const filter = AudioDuckingEngine.buildDuckingFilterExpression([], {
        normalGain: 0.8,
      });
      expect(filter).toBe('volume=0.8');
    });
  });

  describe('LipSyncProvider', () => {
    const synclabs = new SyncLabsLipSyncProvider();

    it('returns supported LipSync models with capabilities and pricing', () => {
      const models = synclabs.getSupportedModels();
      expect(models.length).toBeGreaterThanOrEqual(1);
      expect(models[0].capabilities.supportsLipSync).toBe(true);

      const cost = synclabs.estimateCost('sync-1.6.0', { duration: 10 });
      expect(cost).toBe(0.80); // 10s * $0.08
    });
  });
});
