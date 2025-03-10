class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunks = [];
    this._lastSendTime = 0;
    this.port.onmessage = this._handleMessage.bind(this);
  }

  _handleMessage(event) {
    if (event.data.type === 'sampleRate') {
      this._originalSampleRate = event.data.value;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input.length || !input[0]) return true;

    const inputData = input[0];
    
    // Add processed data to chunks
    this._chunks.push(new Float32Array(inputData));

    // Send audio chunks at regular intervals
    const now = currentTime * 1000;
    if (now - this._lastSendTime >= 500) { // 500ms interval
      this._sendChunks();
      this._lastSendTime = now;
    }

    return true;
  }

  _sendChunks() {
    if (this._chunks.length === 0) return;

    // Concatenate chunks
    const totalLength = this._chunks.reduce((len, chunk) => len + chunk.length, 0);
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this._chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      data: concatenated.buffer
    }, [concatenated.buffer]);

    this._chunks = [];
  }
}

registerProcessor('audio-processor', AudioProcessor);
