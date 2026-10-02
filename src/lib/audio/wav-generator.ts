/**
 * Utility to generate a valid PCM WAV buffer (e.g. 1-second 44.1kHz or 22.05kHz sine wave / speech tone)
 * Allows mock audio generation to be completely playable in browsers and readable by FFprobe/FFmpeg.
 */
export function generateMockWavBuffer(durationSeconds: number = 2.0, frequencyHz: number = 440): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const totalFileSize = 44 + dataSize;

  const buffer = Buffer.alloc(totalFileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalFileSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write gentle sine wave samples with envelope (fade in / fade out) to avoid clicking
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Envelope for soft edges
    let envelope = 1.0;
    if (i < sampleRate * 0.05) envelope = i / (sampleRate * 0.05);
    else if (i > numSamples - sampleRate * 0.05) envelope = (numSamples - i) / (sampleRate * 0.05);

    const amplitude = 0.25 * envelope; // Soft volume
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}
