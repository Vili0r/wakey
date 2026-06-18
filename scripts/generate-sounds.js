const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 10; // 10 seconds
const NUM_SAMPLES = SAMPLE_RATE * DURATION;

function writeWavFile(filepath, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const subChunk2Size = samples.length * numChannels * bytesPerSample;
  const chunkSize = 36 + subChunk2Size;
  const byteRate = SAMPLE_RATE * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0); // ChunkID
  header.writeUInt32LE(chunkSize, 4); // ChunkSize
  header.write('WAVE', 8); // Format
  header.write('fmt ', 12); // Subchunk1ID
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  header.write('data', 36); // Subchunk2ID
  header.writeUInt32LE(subChunk2Size, 40); // Subchunk2Size

  const dataBuffer = Buffer.alloc(subChunk2Size);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    dataBuffer.writeInt16LE(s, i * 2);
  }

  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, Buffer.concat([header, dataBuffer]));
  console.log(`Saved: ${filepath} (${(samples.length / SAMPLE_RATE).toFixed(1)}s)`);
}

// 1. Classic Beep: Beep-beep-beep alarm tone
function generateClassicBeep() {
  const samples = new Float32Array(NUM_SAMPLES);
  const freq = 800; // 800 Hz (standard digital beep)
  const amplitude = 15000;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const periodTime = t % 1.6; // 1.6s repeating period

    let on = false;
    if (periodTime >= 0.0 && periodTime < 0.15) on = true;
    else if (periodTime >= 0.3 && periodTime < 0.45) on = true;
    else if (periodTime >= 0.6 && periodTime < 0.75) on = true;

    if (on) {
      // Fade in/out slightly to avoid clicks
      let fade = 1.0;
      const tInPeriod = periodTime % 0.3;
      if (tInPeriod < 0.01) fade = tInPeriod / 0.01;
      else if (tInPeriod > 0.14) fade = (0.15 - tInPeriod) / 0.01;

      samples[i] = amplitude * Math.sin(2 * Math.PI * freq * t) * fade;
    } else {
      samples[i] = 0;
    }
  }
  return samples;
}

// 2. Mechanical Bell: Ringing mechanical alarm bell
function generateMechanicalBell() {
  const samples = new Float32Array(NUM_SAMPLES);
  const strikeInterval = 0.12; // strikes every 120ms
  const ringPeriod = 2.0;      // 2s cycle (1s ringing, 1s silent)

  // Frequencies for metallic bell sound
  const freqs = [900, 1200, 1700, 2200];
  const weights = [1.0, 0.6, 0.4, 0.2];
  const maxAmp = 12000;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const cycleTime = t % ringPeriod;

    if (cycleTime < 1.0) {
      // Find the start of the current strike
      const strikeIndex = Math.floor(cycleTime / strikeInterval);
      const strikeStart = strikeIndex * strikeInterval;
      const timeSinceStrike = cycleTime - strikeStart;

      // Bell sound is sum of frequencies decaying exponentially
      let val = 0;
      const decay = Math.exp(-20 * timeSinceStrike); // fast decay for metallic ring rate

      for (let f = 0; f < freqs.length; f++) {
        val += weights[f] * Math.sin(2 * Math.PI * freqs[f] * t);
      }

      samples[i] = val * maxAmp * decay;
    } else {
      samples[i] = 0;
    }
  }
  return samples;
}

// 3. Gentle Chimes: Decaying chime tones arpeggiated
function generateGentleChimes() {
  const samples = new Float32Array(NUM_SAMPLES);
  const chimeInterval = 2.5; // chord strike every 2.5s

  // Major pentatonic chime frequencies (C5, E5, G5, A5, C6)
  const notes = [523.25, 659.25, 783.99, 880.00, 1046.50];
  const offsets = [0.0, 0.06, 0.12, 0.18, 0.24]; // delay each note for arpeggio
  const maxAmp = 6000; // soft and gentle

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const cycleTime = t % chimeInterval;

    let val = 0;
    for (let n = 0; n < notes.length; n++) {
      const noteStart = offsets[n];
      if (cycleTime >= noteStart) {
        const timeSinceNote = cycleTime - noteStart;
        const decay = Math.exp(-1.5 * timeSinceNote); // slow decay
        val += Math.sin(2 * Math.PI * notes[n] * timeSinceNote) * decay;
      }
    }
    samples[i] = val * maxAmp;
  }
  return samples;
}

// 4. Warble Siren: rising/falling two-tone siren sweep
function generateWarbleSiren() {
  const samples = new Float32Array(NUM_SAMPLES);
  const sweepPeriod = 0.8; // full up+down sweep every 0.8s
  const loFreq = 600;
  const hiFreq = 1400;
  const amplitude = 11000;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    // Triangle 0..1..0 across the sweep period.
    const phase = (t % sweepPeriod) / sweepPeriod;
    const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    const freq = loFreq + (hiFreq - loFreq) * tri;
    samples[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
  }
  return samples;
}

// 5. Digital Pulse: fast, urgent arcade-style triple pulse
function generateDigitalPulse() {
  const samples = new Float32Array(NUM_SAMPLES);
  const freq = 1046.5; // C6 — bright and alerting
  const amplitude = 13000;
  const period = 0.9; // burst of pulses every 0.9s

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const periodTime = t % period;

    let on = false;
    // Three quick 80ms pulses, 40ms gaps.
    if (periodTime < 0.08) on = true;
    else if (periodTime >= 0.12 && periodTime < 0.2) on = true;
    else if (periodTime >= 0.24 && periodTime < 0.32) on = true;

    if (on) {
      // Square-ish wave for an arcade timbre, softened to avoid clicks.
      const tInPulse = periodTime % 0.12;
      let fade = 1.0;
      if (tInPulse < 0.005) fade = tInPulse / 0.005;
      else if (tInPulse > 0.075) fade = Math.max(0, (0.08 - tInPulse) / 0.005);
      const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
      samples[i] = amplitude * 0.7 * square * fade;
    } else {
      samples[i] = 0;
    }
  }
  return samples;
}

const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');

console.log('Generating custom alarm WAV files...');
writeWavFile(path.join(soundsDir, 'classic_beep.wav'), generateClassicBeep());
writeWavFile(path.join(soundsDir, 'mechanical_bell.wav'), generateMechanicalBell());
writeWavFile(path.join(soundsDir, 'gentle_chimes.wav'), generateGentleChimes());
writeWavFile(path.join(soundsDir, 'warble_siren.wav'), generateWarbleSiren());
writeWavFile(path.join(soundsDir, 'digital_pulse.wav'), generateDigitalPulse());
console.log('Done!');
