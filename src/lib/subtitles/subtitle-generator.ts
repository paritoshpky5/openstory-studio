import fs from 'fs';
import path from 'path';

export interface SubtitleCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  textHindi: string;
  speakerName?: string;
}

export class SubtitleGenerator {
  /**
   * Formats seconds into SRT timestamp string: HH:MM:SS,mmm
   */
  static formatSrtTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  /**
   * Formats seconds into WebVTT timestamp string: HH:MM:SS.mmm
   */
  static formatVttTimestamp(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  /**
   * Splits long Devanagari text into natural two-line subtitle chunks
   */
  static wrapSubtitleText(text: string, maxLineLength: number = 38): string {
    if (text.length <= maxLineLength) return text;

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const w of words) {
      if (!currentLine) {
        currentLine = w;
      } else if ((currentLine + ' ' + w).length <= maxLineLength) {
        currentLine += ' ' + w;
      } else {
        lines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to max 2 lines for clean video presentation
    return lines.slice(0, 2).join('\n');
  }

  /**
   * Generates standard SubRip (.srt) subtitle content
   */
  static generateSrt(cues: SubtitleCue[]): string {
    return cues
      .map((cue, idx) => {
        const index = idx + 1;
        const timeRange = `${this.formatSrtTimestamp(cue.startSeconds)} --> ${this.formatSrtTimestamp(cue.endSeconds)}`;
        const speakerPrefix = cue.speakerName ? `[${cue.speakerName}]: ` : '';
        const wrappedText = this.wrapSubtitleText(speakerPrefix + cue.textHindi);

        return `${index}\n${timeRange}\n${wrappedText}\n`;
      })
      .join('\n');
  }

  /**
   * Generates WebVTT (.vtt) subtitle content
   */
  static generateVtt(cues: SubtitleCue[]): string {
    const header = 'WEBVTT\n\n';
    const body = cues
      .map((cue, idx) => {
        const timeRange = `${this.formatVttTimestamp(cue.startSeconds)} --> ${this.formatVttTimestamp(cue.endSeconds)}`;
        const speakerPrefix = cue.speakerName ? `<v ${cue.speakerName}>` : '';
        const wrappedText = this.wrapSubtitleText(cue.textHindi);

        return `${idx + 1}\n${timeRange}\n${speakerPrefix}${wrappedText}\n`;
      })
      .join('\n');

    return header + body;
  }

  /**
   * Generates subtitle cues from scenes
   */
  static buildCuesFromScenes(scenes: any[]): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    let currentTimelineSeconds = 0;

    const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);

    for (let i = 0; i < sortedScenes.length; i++) {
      const scene = sortedScenes[i];
      const duration = scene.durationSeconds || 4.0;
      const text = scene.narrationHindi || scene.dialogueHindi || scene.summary;

      if (text && text.trim()) {
        cues.push({
          index: i + 1,
          startSeconds: currentTimelineSeconds,
          endSeconds: currentTimelineSeconds + duration,
          textHindi: text.trim(),
          speakerName: scene.dialogueHindi ? 'पात्र' : undefined,
        });
      }

      currentTimelineSeconds += duration;
    }

    return cues;
  }

  /**
   * Generates and writes project subtitle files (.srt and .vtt) to disk
   */
  static saveProjectSubtitles(
    projectId: string,
    cues: SubtitleCue[]
  ): { srtPath: string; vttPath: string; srtContent: string; vttContent: string } {
    const subDir = path.join(process.cwd(), 'data', 'projects', projectId, 'subtitles');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    const srtContent = this.generateSrt(cues);
    const vttContent = this.generateVtt(cues);

    const srtPath = path.join(subDir, 'subtitles.srt');
    const vttPath = path.join(subDir, 'subtitles.vtt');

    fs.writeFileSync(srtPath, srtContent, 'utf8');
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    return { srtPath, vttPath, srtContent, vttContent };
  }
}
