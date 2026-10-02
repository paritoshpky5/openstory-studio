import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db/prisma';
import { JobManager } from './job-manager';
import { getAudioProvider } from '@/lib/providers/audio';
import { HindiTTSPreprocessor } from '@/lib/audio/hindi-preprocessor';
import { PronunciationDictionary } from '@/lib/audio/pronunciation-dict';
import { AudioMasteringService } from '@/lib/audio/audio-mastering';
import { PricingCalculator } from './pricing-calculator';

export interface GenerateAudioRequest {
  projectId: string;
  sceneId?: string;
  characterId?: string;
  assetType: 'NARRATION' | 'DIALOGUE';
  text: string;
  provider?: string;    // 'SARVAM' | 'ELEVENLABS'
  modelId?: string;     // 'bulbul:v1' | 'eleven_multilingual_v2'
  voiceId?: string;     // 'meera', 'arvind', etc.
  settings?: any;
  masterAudio?: boolean; // Run through vocal mastering chain (default true)
  forceRegeneration?: boolean;
}

export interface AudioGenerationResult {
  assetVersion: any;
  job: any;
  rawText: string;
  processedText: string;
  durationSeconds: number;
}

export class AudioWorkflowService {
  /**
   * Main entry point to generate narration or dialogue audio
   */
  static async generateAudio(req: GenerateAudioRequest): Promise<AudioGenerationResult> {
    const providerName = req.provider || 'SARVAM';
    const modelId = req.modelId || (providerName === 'SARVAM' ? 'bulbul:v1' : 'eleven_multilingual_v2');
    const voiceId = req.voiceId || (providerName === 'SARVAM' ? 'meera' : '21m00Tcm4TlvDq8ikWAM');
    const settings = req.settings || {};
    const shouldMaster = req.masterAudio ?? true;

    // 1. Text Preprocessing Pipeline
    // A. Apply project & system pronunciation dictionary
    const projectRules = PronunciationDictionary.loadProjectDictionary(req.projectId);
    const phoneticText = PronunciationDictionary.apply(req.text, projectRules);

    // B. Expand numbers, currency, and normalize Devanagari punctuation
    const processedText = HindiTTSPreprocessor.preprocess(phoneticText);

    // 2. Check Job Idempotency
    const { job, isNew } = await JobManager.getOrCreateJob({
      projectId: req.projectId,
      sceneId: req.sceneId,
      jobType: 'AUDIO',
      provider: providerName,
      modelId: modelId,
      channel: 'DIRECT_API',
      prompt: processedText,
      settings: { ...settings, voiceId, assetType: req.assetType },
      isPaidGeneration: true,
      forceRegeneration: req.forceRegeneration,
    });

    // If job was previously completed and we're not forcing re-generation, fetch and return existing asset
    if (!isNew && job.resultAssetId) {
      const existingAsset = await prisma.assetVersion.findUnique({
        where: { id: job.resultAssetId },
      });
      if (existingAsset) {
        return {
          assetVersion: existingAsset,
          job,
          rawText: req.text,
          processedText,
          durationSeconds: existingAsset.duration || 0,
        };
      }
    }

    try {
      // 3. Mark job as PROCESSING
      await JobManager.updateJobStatus(job.id, 'PROCESSING', undefined, undefined, undefined, 0.1);

      // 4. Chunk text if necessary
      const chunks = HindiTTSPreprocessor.chunkText(processedText, 450);
      const audioProvider = getAudioProvider(providerName);

      // Generate audio buffers for each chunk
      const audioBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const res = await audioProvider.generateAudio(modelId, chunk, voiceId, settings);
        audioBuffers.push(res.buffer);

        const progress = 0.1 + ((i + 1) / chunks.length) * 0.6;
        await JobManager.updateJobStatus(job.id, 'PROCESSING', undefined, undefined, undefined, progress);
      }

      // Combine buffers (simple concat for WAV or single buffer)
      const combinedBuffer = audioBuffers.length === 1 ? audioBuffers[0] : Buffer.concat(audioBuffers);

      // 5. Save Raw Audio to Disk
      const assetId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const subDir = req.assetType === 'NARRATION' ? 'narration' : 'dialogue';
      const projectDir = path.join(process.cwd(), 'data', 'projects', req.projectId, subDir);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const rawFileName = `${assetId}_raw.wav`;
      const rawFilePath = path.join(projectDir, rawFileName);
      fs.writeFileSync(rawFilePath, combinedBuffer);

      let finalFilePath = rawFilePath;
      let finalRelativePath = path.join('projects', req.projectId, subDir, rawFileName).replace(/\\/g, '/');
      let finalDuration = 0;

      // 6. Vocal Chain Audio Mastering (Normalization, High-pass, True Peak Limit)
      if (shouldMaster) {
        await JobManager.updateJobStatus(job.id, 'PROCESSING', undefined, undefined, undefined, 0.8);
        const masteredFileName = `${assetId}.wav`;
        const masteredFilePath = path.join(projectDir, masteredFileName);

        try {
          const masterResult = await AudioMasteringService.masterAudio(rawFilePath, masteredFilePath, {
            targetLufs: req.assetType === 'NARRATION' ? -16.0 : -18.0,
            truePeak: -1.5,
            highpassFreq: 80,
          });
          finalFilePath = masterResult.outputPath;
          finalRelativePath = path.join('projects', req.projectId, subDir, masteredFileName).replace(/\\/g, '/');
          finalDuration = masterResult.durationSeconds;
        } catch (masterErr) {
          console.warn('[AudioWorkflowService] Mastering failed, falling back to raw audio:', masterErr);
        }
      }

      // If duration wasn't obtained from mastering, probe file directly
      if (!finalDuration) {
        try {
          const meta = await AudioMasteringService.probeAudio(finalFilePath);
          finalDuration = meta.duration;
        } catch {
          finalDuration = Math.max(1.0, processedText.length / 15.0);
        }
      }

      // 7. Calculate Pricing
      const estimatedCost = await PricingCalculator.getEffectiveCost(
        req.projectId,
        providerName,
        modelId,
        'AUDIO',
        processedText.length // characters
      );

      // 8. Create AssetVersion Record
      const assetVersion = await prisma.assetVersion.create({
        data: {
          id: assetId,
          projectId: req.projectId,
          sceneId: req.sceneId,
          characterId: req.characterId,
          assetType: req.assetType,
          provider: providerName,
          modelId: modelId,
          channel: 'DIRECT_API',
          filePath: finalRelativePath,
          mimeType: 'audio/wav',
          duration: finalDuration,
          prompt: processedText,
          settings: JSON.stringify({ ...settings, voiceId, rawText: req.text }),
          estimatedCost: estimatedCost,
          actualCost: estimatedCost,
          approvalStatus: 'APPROVED', // Auto-approve voice takes
          isActive: true,
        },
      });

      // If there's an associated scene, link duration if needed
      if (req.sceneId && finalDuration > 0) {
        const scene = await prisma.scene.findUnique({ where: { id: req.sceneId } });
        // If scene's current duration is less than the narration duration, automatically adjust it to fit speech
        if (scene && scene.durationSeconds < finalDuration) {
          await prisma.scene.update({
            where: { id: req.sceneId },
            data: { durationSeconds: Math.ceil(finalDuration) },
          });
        }
      }

      // 9. Mark Job as Completed
      await JobManager.markJobCompleted(job.id, assetVersion.id, {
        assetId: assetVersion.id,
        filePath: finalRelativePath,
        duration: finalDuration,
      });

      return {
        assetVersion,
        job,
        rawText: req.text,
        processedText,
        durationSeconds: finalDuration,
      };
    } catch (error: any) {
      await JobManager.failJob(job.id, error.message);
      throw error;
    }
  }
}
