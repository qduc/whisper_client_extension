# Whisper Live Transcription Chrome Extension

This Chrome extension captures audio from a browser tab and sends it to a WebSocket server for real-time speech transcription. The transcription is then displayed as an overlay on the web page.

## Features

- Real-time speech transcription displayed as an overlay on any web page
- Customizable overlay appearance (text size, opacity)
- Draggable overlay that remembers position
- Automatic text buffering system that displays accumulated text
- Auto-hide overlay after configurable idle time
- Tab audio capture with background processing

## Installation

### Development Mode

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `src` directory from this project

### Build for Production

```
# Future build steps will go here
```

## Usage

1. Click the extension icon in your browser toolbar
2. Enter the WebSocket server URL (default: `ws://localhost:43007`)
3. Click "Start Transcription" to begin capturing audio
4. Speak, and transcription will appear as an overlay on the current tab
5. Drag the overlay to reposition it if needed
6. Click "Stop Transcription" when done

## Configuration

Access the extension options page to configure:

- Text size (small, medium, large)
- Overlay opacity
- Number of text lines to display in buffer
- Minimum text length before displaying
- Maximum idle time before displaying accumulated text
- Overlay hide timeout after inactivity

## Architecture

The extension consists of several components:

- **Background Script**: Manages WebSocket connections and coordinates audio processing
- **Content Script**: Creates and controls the transcription overlay on web pages
- **Offscreen Document**: Handles audio capture and processing (using Chrome's offscreen API)
- **WebSocket Client**: Communicates with the transcription server
- **Audio Processor**: Converts and resamples audio for the Whisper API

For more details about the architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Server Requirements

This extension requires a compatible WebSocket server running the Whisper speech-to-text model. The server should:

1. Accept WebSocket connections
2. Receive audio data as 16-bit PCM at 16kHz
3. Return JSON messages with transcription text

## Development

### Testing

```
npm test
```

The project uses Jest for testing components. Test files are located in the `__tests__` directory.

## Browser Compatibility

- Chrome 116+
- Edge (Chromium-based)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.