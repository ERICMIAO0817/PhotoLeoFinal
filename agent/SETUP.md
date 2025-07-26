# Face Center Camera - Local Setup

## 🦙 Local Model Setup (Recommended)

The app now supports **local vision models** using Ollama! No API keys required.

### Install Ollama

```bash
# macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from: https://ollama.ai/download
```

### Install a Vision Model

Choose one of these vision models (recommended in order):

```bash
# Option 1: LLaVA 7B (Recommended - good balance)
ollama pull llava:7b

# Option 2: LLaVA 13B (Better quality, more RAM needed)  
ollama pull llava:13b

# Option 3: Llama 3.2 Vision (Latest)
ollama pull llama3.2-vision

# Option 4: Small/Fast option
ollama pull llava
```

### Verify Installation

```bash
# Check Ollama is running
ollama list

# Test vision model
ollama run llava:7b "Describe this image" --image path/to/test.jpg
```

## ☁️ Cloud Fallback (Optional)

If no local model is found, the app falls back to OpenRouter API.

### Setup API Key in .env

1. Go to https://openrouter.ai/keys
2. Sign up (free tier available)  
3. Create API key (starts with `sk-or-`)
4. Add to `.env` file:

```bash
# Edit .env file
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
```

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Configure environment (optional)
cp .env .env.local
# Edit .env with your settings

# Start server
npm start

# Open browser
open http://localhost:3000
```

## ⚙️ Environment Configuration

Edit `.env` file to customize:

```bash
# OpenRouter API Key (cloud fallback)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Server port (default: 3000)
PORT=3000

# Preferred local model (optional)
PREFERRED_MODEL=llava:7b

# Ollama host (default: http://localhost:11434)
OLLAMA_HOST=http://localhost:11434
```

## 🔧 How It Works

1. **Local First**: App checks for Ollama + vision models
2. **Auto-detection**: Finds best available model (llava:13b > llava:7b > llava)
3. **Tool Calls**: Uses LLM function calling for precise directions
4. **Cloud Fallback**: Uses OpenRouter if no local model found

## 📊 Model Comparison

| Model | Size | Speed | Quality | RAM Required |
|-------|------|-------|---------|--------------|
| llava | ~4GB | Fast | Good | 8GB+ |
| llava:7b | ~7GB | Medium | Better | 12GB+ |
| llava:13b | ~13GB | Slower | Best | 16GB+ |
| llama3.2-vision | ~11GB | Medium | Excellent | 16GB+ |

## 🐛 Troubleshooting

**Ollama not found:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve
```

**Model not working:**
```bash
# Re-pull the model
ollama pull llava:7b

# Check model list
ollama list
```

**RAM issues:**
- Use smaller model: `ollama pull llava` (4GB)
- Close other applications
- Consider cloud fallback

## 🎯 Features

- ✅ **Real LLM vision analysis** (local or cloud)
- ✅ **Tool-based responses** (move_left, move_right, etc.)
- ✅ **5-check limit** (non-intrusive)
- ✅ **Live arrows** update every 3 seconds
- ✅ **Full-screen camera** with clean UI
- ✅ **Automatic fallback** to cloud if needed

The app intelligently uses the best available option!