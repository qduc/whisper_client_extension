let mediaStream = null;
let audioContext = null;
let websocket = null;
let isCapturing = false;  // Track if capture is in progress

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startCapture') {
    // Check if capture is already in progress
    if (isCapturing) {
      console.log('Capture already in progress, stopping previous capture first');
      stopCapture().then(() => {
        // Small delay to ensure resources are released
        setTimeout(() => {
          startCapture(message.settings, message.tabId)
            .then(() => sendResponse({ status: 'started' }))
            .catch(error => sendResponse({ status: 'error', message: error.message }));
        }, 100);
      });
    } else {
      startCapture(message.settings, message.tabId)
        .then(() => sendResponse({ status: 'started' }))
        .catch(error => sendResponse({ status: 'error', message: error.message }));
    }
    return true; // Required for async sendResponse
  } 
  else if (message.action === 'stopCapture') {
    stopCapture()
      .then(() => sendResponse({ status: 'stopped' }))
      .catch(error => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
});

async function startCapture(settings, tabId) {
  try {
    isCapturing = true;
    // Get the media stream ID for the tab
    // Note: In Chrome 116+, the streamId is now received directly from the service worker
    // instead of calling getMediaStreamId within the offscreen document
    const streamId = await new Promise((resolve, reject) => {
      // Check if the streamId was passed directly from background.js
      if (settings && settings.streamId) {
        resolve(settings.streamId);
      } else {
        // Fall back to the old method if streamId wasn't provided
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(streamId);
          }
        });
      }
    });
    
    // Use the stream ID to capture the tab audio
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          echoCancellation: false
        },
      },
      video: false
    });
    
    if (!stream) {
      isCapturing = false;
      throw new Error('Failed to capture tab audio');
    }
    
    // Store the stream
    mediaStream = stream;
    
    // Notify the service worker that capture started successfully
    chrome.runtime.sendMessage({
      action: 'captureStarted',
      stream: true,  // We can't transfer the actual stream, so we just indicate success
      tabId: tabId,
      settings: settings
    });
    
    // Set up a listener for the stream ending
    stream.getAudioTracks()[0].onended = () => {
      isCapturing = false;
      chrome.runtime.sendMessage({ action: 'streamEnded' });
    };
    
    // Process audio with AudioContext and send it to background via messages
    await processAudio(stream, settings);
    
  } catch (error) {
    isCapturing = false;
    console.error('Error in startCapture:', error);
    chrome.runtime.sendMessage({ 
      action: 'captureError', 
      error: error.message 
    });
    throw error;
  }
}

async function processAudio(stream, settings) {
  // Create audio context
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  // Get url for worklet
  const workletUrl = chrome.runtime.getURL('audioWorkletProcessor.js');

  // Load and register the audio worklet
  await audioContext.audioWorklet.addModule(workletUrl);
  
  // Create audio worklet node
  const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
  
  // Handle messages from the processor
  workletNode.port.onmessage = (event) => {
    if (event.data.type !== 'audio' || !event.data.data) {
      console.warn('Received invalid audio data from worklet');
      return;
    }
    
    const audioData = new Float32Array(event.data.data);
    // Import and process the audio data
    import('./audioProcessor.js').then(({ processAudioChunk }) => {
      const processedData = processAudioChunk(audioData, audioContext.sampleRate);
      chrome.runtime.sendMessage({
        action: 'audioChunk',
        audioData: Array.from(processedData),
        settings: settings
      });
    });
  };

  // Connect the nodes
  source.connect(workletNode);
  workletNode.connect(audioContext.destination);
  source.connect(audioContext.destination); // Connect to destination for playback
}

async function stopCapture() {
  // Stop media stream
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  // Close audio context
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
  
  // Reset capture state
  isCapturing = false;
  
  // Notify background
  chrome.runtime.sendMessage({ action: 'captureStopped' });
}

// Keep alive
setInterval(() => {
  if (mediaStream) {
    chrome.runtime.sendMessage({ action: 'keepAlive' });
  }
}, 25000);