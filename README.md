# Koko — On-Device AI 3D Anime Companion

A 100% local, on-device 3D Anime Girl companion built with **React**, **Three.js**, **WebGPU (`@mlc-ai/web-llm`)**, **Kokoro-82M (`kokoro-js`)** neural TTS, and optional BYOK cloud LLM/TTS support.

## Features
- **On-Device & Flexible AI Brain**:
  - **WebGPU Mode (`@mlc-ai/web-llm`)**: Runs models including `Qwen 3.5` (0.8B / 2B / 4B / 9B), `Gemma 4 E2B`, `Ministral 3 3B`, `Phi-4 Mini`, and `Gemma 3 1B` directly on your GPU inside the browser and caches them locally.
  - **Optional API Keys (BYOK)**: Connect **Google Gemini**, **OpenAI**, **Anthropic Claude**, **OpenRouter**, or any custom OpenAI-compatible endpoint directly from the UI (keys stay local in your browser).
  - **Local Server Mode**: Connects to `llama-server.exe` (`http://127.0.0.1:8080/v1`) or Ollama (`http://127.0.0.1:11434/v1`) for running local `.gguf` models.
  - **Quick Preview Mode**: Instant personality-aware responses while downloading models or testing offline.
- **Realistic Neural TTS & Waveform Lip-Sync**:
  - **Kokoro-82M On-Device (`kokoro-js`)**: Runs quantized Kokoro-82M locally on CPU/WASM with 9 voice presets and streaming sentence playback.
  - **Optional Cloud Voices**: Supports **OpenAI TTS** (`gpt-4o-mini-tts`) and **ElevenLabs** (`eleven_flash_v2_5`), plus automatic browser **Web Speech API** fallback.
  - **Real-Time Lip-Sync**: Web Audio `AnalyserNode` waveform RMS amplitude drives smooth 3D mouth movement.
- **Cel-Shaded 3D Anime Model + `.VRM` Support**:
  - Custom sculpted anime head, high-res procedural anime iris textures (`sparkle`, `starry`, `sharp_tsun`, `gentle`, `cat_iris`), dynamic blinking, cursor eye-tracking, blush, and interactive head pats.
  - 5 hairstyles with spring-damper physics (`twintails`, `long_hime`, `ponytail`, `bob_ahoge`, `half_buns`).
  - 11 outfits (`sailor_uniform`, `cozy_hoodie`, `maid_frill`, `cyber_jacket`, `idol_dress`, `magical_girl`, `gothic_lolita`, `kimono_modern`, `shrine_miko`, `angel_valkyrie`, `bunny_stage`) + 1-click color palettes (`Sakura`, `Gothic`, `Shrine`, `Valkyrie`, `Cyber`, `Midnight`) + 6 accessories (`none`, `cat_ears`, `ribbons`, `halo`, `glasses`, `headphones`).
  - Drag & drop any `.vrm` avatar file onto the 3D viewport to load your own model.

## Run Locally
```bash
npm install
npm run dev
```
Then open `http://localhost:5173` in Chrome or Edge (WebGPU enabled).

## License
All original source code added in this repository is dedicated to the public domain under **The Unlicense** — see [LICENSE](./LICENSE). Third-party libraries and dependencies listed in `package.json` remain under their respective open-source licenses.
