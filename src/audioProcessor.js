// Audio processor for WhisperLive Chrome extension
// Handles audio capture and conversion for streaming to WebSocket

// Constants for audio processing
const SAMPLE_RATE = 16000; // Whisper expects 16kHz audio
const PROCESSOR_BUFFER_SIZE = 4096;
const SEND_INTERVAL_MS = 500; // Send audio every 500ms

/**
 * Process audio from the captured media stream and send to websocket
 * @param {MediaStream} mediaStream - The captured tab audio stream
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {Object} websocket - WebSocket client instance
 * @returns {Promise} - Resolves when setup is complete
 */
export async function processAudio(mediaStream, audioContext, websocket) {
  // First, load the audio worklet
  await audioContext.audioWorklet.addModule('audioWorkletProcessor.js');

  return new Promise((resolve) => {
    // Create source from the media stream
    const source = audioContext.createMediaStreamSource(mediaStream);
    
    // Create AudioWorkletNode
    const processor = new AudioWorkletNode(audioContext, 'audio-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1
    });
    
    // Tell the processor the original sample rate
    processor.port.postMessage({
      type: 'sampleRate',
      value: audioContext.sampleRate
    });
    
    // Handle audio data from the worklet
    processor.port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        const audioData = new Float32Array(event.data.data);
        const processedData = audioContext.sampleRate !== SAMPLE_RATE ?
          resampleAudio(audioData, audioContext.sampleRate, SAMPLE_RATE) :
          audioData;
        
        if (websocket.isConnected()) {
          const pcmData = floatTo16BitPCM(processedData);
          websocket.sendAudio(pcmData);
        }
      }
    };
    
    // Connect nodes
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    // Clean up function
    websocket.onDisconnect(() => {
      processor.disconnect();
      source.disconnect();
    });
    
    resolve();
  });
}

/**
 * Simple linear resampling of audio data
 * @param {Float32Array} audioData - Original audio data
 * @param {number} originalSampleRate - Original sample rate
 * @param {number} targetSampleRate - Target sample rate
 * @returns {Float32Array} - Resampled audio data
 */
function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
  if (!audioData || !audioData.length) {
    console.warn('Invalid audio data passed to resampleAudio');
    return new Float32Array(0);
  }
  
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    
    // Simple linear interpolation
    if (index + 1 < audioData.length) {
      result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
    } else {
      result[i] = audioData[index];
    }
  }
  
  return result;
}

/**
 * Convert Float32Array audio data to 16-bit PCM
 * @param {Float32Array} float32Array - Audio data as float
 * @returns {Int16Array} - Audio data as 16-bit PCM
 */
function floatTo16BitPCM(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return int16Array;
}

// Add this new function export for the offscreen document
export function processAudioChunk(audioData, sampleRate) {
  // Resample if needed
  const needsResampling = sampleRate !== 16000;
  const processedData = needsResampling ? 
    resampleAudio(audioData, sampleRate, 16000) : 
    audioData;
  
  // Convert to Int16Array
  return floatTo16BitPCM(processedData);
}