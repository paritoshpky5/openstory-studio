import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HindiTTSPreprocessor } from '../hindi-preprocessor';
import { PronunciationDictionary } from '../pronunciation-dict';
import { AudioWorkflowService } from '@/lib/services/audio-workflow-service';
import prisma from '@/lib/db/prisma';
import fs from 'fs';
import path from 'path';

describe('Hindi Audio Pipeline & Preprocessor', () => {
  describe('HindiTTSPreprocessor', () => {
    it('correctly expands single and double digit numbers into Hindi words', () => {
      expect(HindiTTSPreprocessor.numberToHindiWords(0)).toBe('शून्य');
      expect(HindiTTSPreprocessor.numberToHindiWords(5)).toBe('पाँच');
      expect(HindiTTSPreprocessor.numberToHindiWords(15)).toBe('पंद्रह');
      expect(HindiTTSPreprocessor.numberToHindiWords(47)).toBe('सैंतालीस');
      expect(HindiTTSPreprocessor.numberToHindiWords(100)).toBe('सौ');
    });

    it('correctly expands large numbers (thousands, lakhs, crores)', () => {
      expect(HindiTTSPreprocessor.numberToHindiWords(1947)).toBe('एक हज़ार नौ सौ सैंतालीस');
      expect(HindiTTSPreprocessor.numberToHindiWords(50000)).toBe('पचास हज़ार');
      expect(HindiTTSPreprocessor.numberToHindiWords(100000)).toBe('एक लाख');
      expect(HindiTTSPreprocessor.numberToHindiWords(20000000)).toBe('दो करोड़');
    });

    it('expands currency expressions (₹ and Rs.) into Hindi words', () => {
      const input = 'उसने ₹500 का सामान खरीदा।';
      const output = HindiTTSPreprocessor.expandCurrency(input);
      expect(output).toContain('पाँच सौ रुपये');
    });

    it('normalizes Latin period to Devanagari purna viram', () => {
      const input = 'राजा महल में बैठा था. उसने आदेश दिया.';
      const output = HindiTTSPreprocessor.normalizePunctuation(input);
      expect(output).toBe('राजा महल में बैठा था। उसने आदेश दिया।');
    });

    it('chunks long Hindi stories safely by sentence delimiters', () => {
      const story = 'एक समय की बात है। एक प्रतापी राजा राज्य करता था। उसकी प्रजा बहुत सुखी थी। चारों ओर शांति और समृद्धि थी।';
      const chunks = HindiTTSPreprocessor.chunkText(story, 60);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('PronunciationDictionary', () => {
    it('replaces common English cinematic Indian words with Devanagari', () => {
      const text = 'Maharaja of Ayodhya visited the Gurukul.';
      const result = PronunciationDictionary.apply(text);
      expect(result).toContain('महाराजा');
      expect(result).toContain('अयोध्या');
      expect(result).toContain('गुरुकुल');
    });

    it('applies custom project-level pronunciation rules', () => {
      const text = 'Devendra met Suryavanshi in the fortress.';
      const customRules = {
        Devendra: 'देवेंद्र',
        Suryavanshi: 'सूर्यवंशी',
      };
      const result = PronunciationDictionary.apply(text, customRules);
      expect(result).toContain('देवेंद्र');
      expect(result).toContain('सूर्यवंशी');
    });
  });

  describe('AudioWorkflowService', () => {
    const testProjectId = 'test_audio_proj_1';
    let testSceneId: string;

    beforeAll(async () => {
      // Create test project and scene in DB
      await prisma.project.create({
        data: {
          id: testProjectId,
          name: 'Audio Test Project',
          targetLanguage: 'hi',
          currentPhase: 'STORY',
        },
      });

      const scene = await prisma.scene.create({
        data: {
          projectId: testProjectId,
          sceneNumber: 1,
          title: 'Royal Arrival',
          location: 'Durbar Hall',
          timeOfDay: 'DAY',
          environment: 'Palace',
          lighting: 'Golden Sunbeams',
          mood: 'Triumphant',
          summary: 'The king enters.',
          narrationHindi: 'राजा विक्रमादित्य ने अपने सिंहासन की ओर कदम बढ़ाया।',
          durationSeconds: 3.0,
        },
      });
      testSceneId = scene.id;
    });

    afterAll(async () => {
      // Clean up database records
      await prisma.assetVersion.deleteMany({ where: { projectId: testProjectId } });
      await prisma.generationJob.deleteMany({ where: { projectId: testProjectId } });
      await prisma.scene.deleteMany({ where: { projectId: testProjectId } });
      await prisma.project.deleteMany({ where: { id: testProjectId } });

      // Clean up test files
      const testDir = path.join(process.cwd(), 'data', 'projects', testProjectId);
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('generates, masters, and saves Hindi narration audio', async () => {
      const result = await AudioWorkflowService.generateAudio({
        projectId: testProjectId,
        sceneId: testSceneId,
        assetType: 'NARRATION',
        text: 'राजा विक्रमादित्य ने ₹1000 का पुरस्कार दिया.',
        provider: 'SARVAM',
        voiceId: 'meera',
        masterAudio: true,
      });

      expect(result.assetVersion).toBeDefined();
      expect(result.assetVersion.assetType).toBe('NARRATION');
      expect(result.assetVersion.provider).toBe('SARVAM');
      expect(result.processedText).toContain('एक हज़ार रुपये');
      expect(result.durationSeconds).toBeGreaterThan(0);

      // Verify file exists on disk
      const filePath = path.join(process.cwd(), 'data', result.assetVersion.filePath);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify GenerationJob was completed
      const job = await prisma.generationJob.findUnique({
        where: { id: result.job.id },
      });
      expect(job?.status).toBe('COMPLETED');
    }, 25000);

    it('enforces idempotency and reuses existing audio for identical prompts', async () => {
      const prompt = 'यह एक समान कथन है जो दोबारा नहीं बनना चाहिए।';

      const firstResult = await AudioWorkflowService.generateAudio({
        projectId: testProjectId,
        sceneId: testSceneId,
        assetType: 'NARRATION',
        text: prompt,
        provider: 'SARVAM',
        voiceId: 'meera',
      });

      const secondResult = await AudioWorkflowService.generateAudio({
        projectId: testProjectId,
        sceneId: testSceneId,
        assetType: 'NARRATION',
        text: prompt,
        provider: 'SARVAM',
        voiceId: 'meera',
      });

      // Should return the exact same asset ID without recreating
      expect(secondResult.assetVersion.id).toBe(firstResult.assetVersion.id);
    }, 25000);
  });
});
