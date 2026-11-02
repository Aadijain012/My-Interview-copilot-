# AI Assistant - System Audio Transcription

Captures **system audio** (Google Meet, Zoom, browser) and transcribes it in real time using Deepgram. Transcripts are printed to the terminal.

## Setup

```bash
# Install dependencies
npm install

# Copy environment template and add your Deepgram API key
cp .env.example .env
# Edit .env and set DEEPGRAM_API_KEY=your-deepgram-api-key
```

On Windows, copy `.env.example` to `.env` manually if `cp` is not available.

## Run

```bash
npm start
```

1. Click **"Start (system audio)"** in the app window
2. When prompted, select a screen or window to share (e.g. your browser with Google Meet)
3. Enable **"Share audio"** in the picker
4. Speak or play audio — transcripts appear in the terminal

**Expected output:**
```
Listening to system audio...
Select a screen/window when prompted.
Transcripts will appear below.
========================================

[ipc] prepare-capture, useMicrophone= false
[audioCapture] startCapture, useMicrophone= false
[deepgram] Starting live connection...
[deepgram] WebSocket connected
[ipc] audio-chunk #1 8192 bytes
...

Transcript:
"What is polymorphism in OOP?"
```

## Features

- **System audio capture** - Electron `desktopCapturer` + `getDisplayMedia` with `audio: 'loopback'` (Windows)
- **Real-time speech-to-text** - Deepgram WebSocket streaming API
- **Raw PCM streaming** - Web Audio API → linear16 → Deepgram

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEEPGRAM_API_KEY` | Your Deepgram API key (required for transcription) |
| `OPENAI_API_KEY` | Optional - for AI answer generation (legacy) |

## Project Structure

```
overlay-ai/
├── main.js               # Main process: capture window, display media handler
├── src/
│   ├── preload.js        # Context bridge for IPC
│   ├── deepgramService.js # Deepgram WebSocket streaming transcription
│   └── ipcHandlers.js    # IPC handlers: audio chunks → Deepgram
├── renderer/
│   ├── capture.html      # Capture window UI
│   └── audioCapture.js   # System audio → PCM (Web Audio API)
├── renderer.js           # Capture window UI logic
├── .env.example
└── package.json
```

## Architecture

- **Renderer**: `getDisplayMedia` with `audio: 'loopback'` → MediaStream → AudioContext → ScriptProcessor → raw PCM (linear16, 44.1kHz)
- **IPC**: `audio-chunk` sends Buffer to main process
- **Main process**: Deepgram WebSocket live streaming, prints transcripts to console
