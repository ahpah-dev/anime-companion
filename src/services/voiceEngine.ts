import type { KokoroTTS } from 'kokoro-js';
import { PersonalityConfig } from '../types/companion';

export interface LipSyncCallback {
  (speaking: boolean, energy: number): void;
}

export interface KokoroLoadProgress {
  progress: number;
  status: string;
}

class VoiceEngine {
  private synth =
    typeof window !== 'undefined' ? window.speechSynthesis : null;
  private lipSyncTimer: number | null = null;
  private rafId: number | null = null;
  private currentEnergy = 0;
  private speakingActive = false;
  private recognition: unknown = null;

  // Neural Web Audio pipeline
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private activePlaybackId = 0;

  // On-device Kokoro-82M neural TTS
  private kokoroInstance: KokoroTTS | null = null;
  private kokoroLoading = false;
  private kokoroPromise: Promise<KokoroTTS> | null = null;

  public isKokoroLoaded(): boolean {
    return Boolean(this.kokoroInstance);
  }

  public isKokoroLoading(): boolean {
    return this.kokoroLoading;
  }

  public async loadKokoro(
    onProgress?: (info: KokoroLoadProgress) => void
  ): Promise<KokoroTTS> {
    if (this.kokoroInstance) {
      onProgress?.({ progress: 1, status: 'Kokoro 82M Neural Voice Ready' });
      return this.kokoroInstance;
    }
    if (this.kokoroPromise) {
      return this.kokoroPromise;
    }

    this.kokoroLoading = true;
    this.kokoroPromise = (async () => {
      try {
        onProgress?.({
          progress: 0.05,
          status: 'Loading Kokoro-82M neural voice runtime...',
        });
        const { KokoroTTS: KokoroCls } = await import('kokoro-js');
        const tts = await KokoroCls.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          {
            dtype: 'q8',
            device: 'wasm',
            progress_callback: (evt: unknown) => {
              const e = evt as {
                status?: string;
                progress?: number;
                file?: string;
              };
              if (typeof e.progress === 'number') {
                onProgress?.({
                  progress: Math.min(0.99, e.progress / 100),
                  status: e.file
                    ? `Downloading ${e.file}...`
                    : e.status || 'Downloading neural voice...',
                });
              } else if (e.status) {
                onProgress?.({ progress: 0.2, status: e.status });
              }
            },
          }
        );
        this.kokoroInstance = tts;
        onProgress?.({ progress: 1, status: 'Kokoro 82M Neural Voice Ready' });
        return tts;
      } finally {
        this.kokoroLoading = false;
        this.kokoroPromise = null;
      }
    })();

    return this.kokoroPromise;
  }

  private ensureAudioContext(): {
    ctx: AudioContext;
    analyser: AnalyserNode;
  } {
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.55;
      this.analyser.connect(this.audioCtx.destination);
    }
    return { ctx: this.audioCtx, analyser: this.analyser };
  }

  private startWaveformLipSync(
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const { analyser } = this.ensureAudioContext();
    const data = new Float32Array(analyser.fftSize);
    let smooth = 0;

    const tick = () => {
      if (!this.speakingActive || this.activePlaybackId !== playbackId) {
        return;
      }
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      const target = Math.min(1, rms * 5.2);
      smooth = smooth * 0.45 + target * 0.55;
      onLipSync(true, smooth);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public pickBestAnimeVoice(preferredName?: string): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    if (!voices.length) return null;

    if (preferredName) {
      const exact = voices.find((v) => v.name === preferredName);
      if (exact) return exact;
    }

    const preferredPatterns = [
      /aria.*online/i,
      /jenny.*online/i,
      /ana.*online/i,
      /sonia.*online/i,
      /google us english/i,
      /google uk english female/i,
      /zira/i,
      /female/i,
      /samantha/i,
    ];

    for (const pat of preferredPatterns) {
      const match = voices.find((v) => pat.test(v.name) && v.lang.startsWith('en'));
      if (match) return match;
    }

    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  public async speak(
    text: string,
    personality: PersonalityConfig,
    onLipSync: LipSyncCallback
  ) {
    this.stopSpeaking(onLipSync);

    const clean = text
      .replace(/\[mood:[^\]]+\]/gi, '')
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;

    const playbackId = ++this.activePlaybackId;

    // 1. Optional OpenAI Cloud Neural TTS
    if (personality.ttsEngine === 'openai_tts' && personality.ttsApiKey.trim()) {
      try {
        await this.speakOpenAI(clean, personality, playbackId, onLipSync);
        return;
      } catch {
        // Fall through to Kokoro or Browser voice on transient failure
      }
    }

    // 2. Optional ElevenLabs Cloud Neural TTS
    if (personality.ttsEngine === 'elevenlabs' && personality.ttsApiKey.trim()) {
      try {
        await this.speakElevenLabs(clean, personality, playbackId, onLipSync);
        return;
      } catch {
        // Fall through
      }
    }

    // 3. On-Device Kokoro-82M Neural TTS (if loaded)
    if (personality.ttsEngine === 'kokoro' && this.kokoroInstance) {
      try {
        await this.speakKokoro(clean, personality, playbackId, onLipSync);
        return;
      } catch {
        // Fall through to browser speech
      }
    }

    // 4. Instant Browser SpeechSynthesis fallback
    this.speakBrowser(clean, personality, playbackId, onLipSync);
  }

  private async speakKokoro(
    text: string,
    personality: PersonalityConfig,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    if (!this.kokoroInstance) return;
    const { ctx, analyser } = this.ensureAudioContext();
    this.speakingActive = true;
    this.startWaveformLipSync(playbackId, onLipSync);

    const voiceId = (personality.kokoroVoice || 'af_heart') as Parameters<
      KokoroTTS['stream']
    >[1] extends { voice?: infer V }
      ? V
      : never;

    let nextStartTime = ctx.currentTime + 0.03;
    let lastSource: AudioBufferSourceNode | null = null;

    const stream = this.kokoroInstance.stream(text, {
      voice: voiceId,
      speed: personality.voiceRate || 1.0,
    });

    for await (const chunk of stream) {
      if (this.activePlaybackId !== playbackId || !this.speakingActive) {
        return;
      }
      const samples = chunk.audio.audio;
      const sampleRate = chunk.audio.sampling_rate || 24000;
      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);

      const startAt = Math.max(ctx.currentTime + 0.02, nextStartTime);
      source.start(startAt);
      nextStartTime = startAt + buffer.duration;
      this.activeSources.push(source);
      lastSource = source;
    }

    if (lastSource) {
      lastSource.onended = () => {
        if (this.activePlaybackId === playbackId) {
          this.stopSpeaking(onLipSync);
        }
      };
    } else {
      this.stopSpeaking(onLipSync);
    }
  }

  private async playEncodedAudioBlob(
    arrayBuffer: ArrayBuffer,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    if (this.activePlaybackId !== playbackId) return;
    const { ctx, analyser } = this.ensureAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (this.activePlaybackId !== playbackId) return;

    this.speakingActive = true;
    this.startWaveformLipSync(playbackId, onLipSync);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    source.onended = () => {
      if (this.activePlaybackId === playbackId) {
        this.stopSpeaking(onLipSync);
      }
    };
    this.activeSources.push(source);
    source.start();
  }

  private async speakOpenAI(
    text: string,
    personality: PersonalityConfig,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personality.ttsApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: personality.ttsCloudVoice || 'nova',
        input: text,
        speed: personality.voiceRate || 1.0,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS error ${res.status}`);
    const buf = await res.arrayBuffer();
    await this.playEncodedAudioBlob(buf, playbackId, onLipSync);
  }

  private async speakElevenLabs(
    text: string,
    personality: PersonalityConfig,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    // Default expressive female voice ("Rachel" / custom Voice ID)
    const voiceId = personality.ttsCloudVoice?.trim() || '21m00Tcm4TlvDq8ikWAM';
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': personality.ttsApiKey.trim(),
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
        }),
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs TTS error ${res.status}`);
    const buf = await res.arrayBuffer();
    await this.playEncodedAudioBlob(buf, playbackId, onLipSync);
  }

  private speakBrowser(
    clean: string,
    personality: PersonalityConfig,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    if (!this.synth) {
      this.simulateLipSync(clean, playbackId, onLipSync);
      return;
    }

    const utter = new SpeechSynthesisUtterance(clean);
    const voice = this.pickBestAnimeVoice(personality.voiceName);
    if (voice) utter.voice = voice;
    utter.pitch = personality.voicePitch;
    utter.rate = personality.voiceRate;
    utter.volume = 0.95;

    this.speakingActive = true;
    this.currentEnergy = 0.65;

    utter.onstart = () => {
      if (this.activePlaybackId !== playbackId) return;
      this.speakingActive = true;
      this.startLipSyncLoop(playbackId, onLipSync);
    };

    utter.onboundary = () => {
      this.currentEnergy = 0.65 + Math.random() * 0.35;
    };

    utter.onend = () => {
      if (this.activePlaybackId === playbackId) {
        this.stopSpeaking(onLipSync);
      }
    };

    utter.onerror = () => {
      if (this.activePlaybackId === playbackId) {
        this.stopSpeaking(onLipSync);
      }
    };

    this.synth.speak(utter);
    this.startLipSyncLoop(playbackId, onLipSync);
  }

  private startLipSyncLoop(playbackId: number, onLipSync: LipSyncCallback) {
    if (this.lipSyncTimer !== null) return;
    let phase = 0;
    this.lipSyncTimer = window.setInterval(() => {
      if (!this.speakingActive || this.activePlaybackId !== playbackId) {
        this.stopSpeaking(onLipSync);
        return;
      }
      phase += 0.38;
      const wave = 0.35 + Math.abs(Math.sin(phase)) * 0.45;
      this.currentEnergy = Math.max(wave, this.currentEnergy * 0.84);
      onLipSync(true, Math.min(1, this.currentEnergy));
    }, 45);
  }

  private simulateLipSync(
    text: string,
    playbackId: number,
    onLipSync: LipSyncCallback
  ) {
    this.speakingActive = true;
    this.startLipSyncLoop(playbackId, onLipSync);
    const ms = Math.min(6000, Math.max(1200, text.length * 52));
    window.setTimeout(() => {
      if (this.activePlaybackId === playbackId) {
        this.stopSpeaking(onLipSync);
      }
    }, ms);
  }

  public stopSpeaking(onLipSync?: LipSyncCallback) {
    this.activePlaybackId++;
    this.speakingActive = false;
    this.currentEnergy = 0;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.lipSyncTimer !== null) {
      clearInterval(this.lipSyncTimer);
      this.lipSyncTimer = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore already stopped sources
      }
    }
    this.activeSources = [];

    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    onLipSync?.(false, 0);
  }

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onEnd: () => void,
    onError: (msg: string) => void
  ) {
    const w = window as unknown as Record<string, new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
      onerror: ((ev: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }>;

    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) {
      onError('Voice input requires Chrome or Edge SpeechRecognition.');
      onEnd();
      return;
    }

    this.stopListening();
    const rec = new Rec();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (ev) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < ev.results.length; i++) {
        transcript += ev.results[i][0].transcript;
        if (ev.results[i].isFinal) isFinal = true;
      }
      onResult(transcript.trim(), isFinal);
    };

    rec.onerror = (ev) => {
      onError(
        ev.error === 'not-allowed'
          ? 'Microphone access denied.'
          : `Mic error: ${ev.error}`
      );
      onEnd();
    };

    rec.onend = () => {
      this.recognition = null;
      onEnd();
    };

    this.recognition = rec;
    rec.start();
  }

  public stopListening() {
    if (
      this.recognition &&
      typeof (this.recognition as { stop?: () => void }).stop === 'function'
    ) {
      try {
        (this.recognition as { stop: () => void }).stop();
      } catch {
        // ignore
      }
    }
    this.recognition = null;
  }
}

export const voiceEngine = new VoiceEngine();
