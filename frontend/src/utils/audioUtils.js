export async function convertToWav(blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const targetSampleRate = 16000;
    const offlineContext = new OfflineAudioContext(
      1,
      (audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate,
      targetSampleRate,
    );
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    const resampledBuffer = await offlineContext.startRendering();
    return audioBufferToWav(resampledBuffer);
  } catch (err) {
    console.warn('OfflineAudioContext gagal, gunakan fallback langsung', err);
    // Fallback: langsung konversi tanpa resample (asumsi sample rate asli 44.1k atau 48k)
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  }
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  let samples = buffer.getChannelData(0);
  if (numChannels > 1) {
    const right = buffer.getChannelData(1);
    samples = samples.map((l, i) => (l + right[i]) / 2);
  }

  const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
