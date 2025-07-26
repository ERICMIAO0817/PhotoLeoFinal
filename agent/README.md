# Face Center Camera

A full-screen camera app that uses local AI to analyze if your face is centered in the frame.

## Features

📸 **Full-screen camera interface** - Immersive camera experience
🤖 **Local AI analysis** - Uses HuggingFace Transformers with Gemma model
🎯 **Face centering guidance** - Get instant feedback on face positioning
⚡ **No API keys required** - Runs completely locally
📱 **Mobile friendly** - Works on phone and desktop

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open http://localhost:3000 in your browser.

## Usage

1. Allow camera access when prompted
2. Position your face in the center circle guide
3. Tap the 📸 button (or press Space/Enter)
4. Get instant AI feedback on your face positioning
5. Tap "Take Another Photo" to try again

## Keyboard Shortcuts

- **Space/Enter**: Take photo
- **Escape**: Close results

## Technical Details

- **Frontend**: Pure HTML/CSS/JS with full-screen camera
- **Backend**: Node.js + Express
- **AI Model**: HuggingFace Transformers (BLIP image captioning + Gemma fallback)
- **Image Processing**: Canvas API for capture, Multer for uploads

## Development

```bash
# Development mode with auto-reload
npm run dev
```

The app automatically falls back to simple heuristics if the AI model fails to load.

## Performance

- CPU-only inference for maximum compatibility
- Lightweight models for fast analysis
- Fallback responses ensure the app always works