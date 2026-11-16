import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cpu,
  Hand,
  Heart,
  History,
  Mic,
  MicOff,
  Send,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AIEngineModal } from './components/AIEngineModal';
import { CustomizerPanel } from './components/CustomizerPanel';
import {
  API_PROVIDER_PRESETS,
  CHARACTER_PRESETS,
  WEBLLM_MODELS,
} from './data/presets';
import { localAI } from './services/localAI';
import { voiceEngine } from './services/voiceEngine';
import { AnimeSceneController } from './three/AnimeScene';
import {
  AIEngineMode,
  ApiKeyConfig,
  AppearanceConfig,
  CharacterPreset,
  ChatMessage,
  Mood,
  PersonalityConfig,
} from './types/companion';

const STORAGE_KEY = 'koko_anime_companion_v1';
const API_STORAGE_KEY = 'koko_anime_api_config_v1';

function loadSavedApiConfig(): ApiKeyConfig {
  try {
    const raw = localStorage.getItem(API_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.provider) {
        return {
          provider: parsed.provider,
          apiKey: parsed.apiKey ?? '',
          baseUrl: parsed.baseUrl ?? API_PROVIDER_PRESETS.gemini.baseUrl,
          model: parsed.model ?? API_PROVIDER_PRESETS.gemini.defaultModel,
          rememberKey: Boolean(parsed.rememberKey),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    provider: 'gemini',
    apiKey: '',
    baseUrl: API_PROVIDER_PRESETS.gemini.baseUrl,
    model: API_PROVIDER_PRESETS.gemini.defaultModel,
    rememberKey: false,
  };
}

function loadSavedState(): {
  presetId: string | null;
  appearance: AppearanceConfig;
  personality: PersonalityConfig;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.appearance && parsed.personality) {
        return {
          presetId: parsed.presetId ?? null,
          appearance: {
            ...CHARACTER_PRESETS[0].appearance,
            ...parsed.appearance,
          },
          personality: {
            ...CHARACTER_PRESETS[0].personality,
            ...parsed.personality,
          },
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  const def = CHARACTER_PRESETS[0];
  return {
    presetId: def.id,
    appearance: def.appearance,
    personality: def.personality,
  };
}

export function App() {
  const initial = useRef(loadSavedState()).current;

  const [activePresetId, setActivePresetId] = useState<string | null>(
    initial.presetId
  );
  const [appearance, setAppearance] = useState<AppearanceConfig>(
    initial.appearance
  );
  const [personality, setPersonality] = useState<PersonalityConfig>(
    initial.personality
  );
  const [mood, setMood] = useState<Mood>('happy');

  // Panels & modals
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'portrait' | 'full'>(
    'portrait'
  );
  const [draggingVrm, setDraggingVrm] = useState(false);
  const [vrmFileName, setVrmFileName] = useState<string | null>(null);

  // On-device AI state (defaults to WebGPU; falls back to instant preview until loaded)
  const [aiMode, setAiMode] = useState<AIEngineMode>('webgpu');
  const [selectedModelId, setSelectedModelId] = useState<string>(
    WEBLLM_MODELS[0].id
  );
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadingWebLLM, setLoadingWebLLM] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localServerUrl, setLocalServerUrl] = useState(
    'http://127.0.0.1:8080/v1'
  );
  const [localServerModel, setLocalServerModel] = useState('local-model');
  const [apiConfig, setApiConfig] = useState<ApiKeyConfig>(() =>
    loadSavedApiConfig()
  );

  // Chat & voice state
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      role: 'assistant',
      content: CHARACTER_PRESETS[0].greeting,
      mood: 'happy',
      timestamp: Date.now(),
    },
  ]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [kokoroLoaded, setKokoroLoaded] = useState(false);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const [kokoroProgress, setKokoroProgress] = useState(0);
  const [kokoroStatus, setKokoroStatus] = useState('');
  const [kokoroError, setKokoroError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<AnimeSceneController | null>(null);
  const personalityRef = useRef(personality);
  personalityRef.current = personality;
  const aiModeRef = useRef(aiMode);
  aiModeRef.current = aiMode;
  const apiConfigRef = useRef(apiConfig);
  apiConfigRef.current = apiConfig;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isGeneratingRef = useRef(isGenerating);
  isGeneratingRef.current = isGenerating;

  // Save customizations locally
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          presetId: activePresetId,
          appearance,
          personality,
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [activePresetId, appearance, personality]);

  // Save optional API config only when user opts in to remembering key
  useEffect(() => {
    try {
      if (apiConfig.rememberKey) {
        localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiConfig));
      } else {
        localStorage.removeItem(API_STORAGE_KEY);
      }
    } catch {
      // ignore quota errors
    }
  }, [apiConfig]);

  const speakWithLipSync = useCallback((text: string) => {
    const p = personalityRef.current;
    if (!p.autoSpeak) return;
    voiceEngine.speak(text, p, (speaking, energy) => {
      setIsSpeaking(speaking);
      sceneRef.current?.setSpeaking(speaking, energy);
    });
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isGeneratingRef.current) return;

      voiceEngine.stopSpeaking((s, e) => {
        setIsSpeaking(s);
        sceneRef.current?.setSpeaking(s, e);
      });

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const prevHistory = messagesRef.current;
      setMessages((m) => [...m, userMsg]);
      setInputText('');
      setIsGenerating(true);
      setStreamingText('...');
      sceneRef.current?.setThinking(true);

      // If WebGPU mode is active but model isn't loaded yet, gracefully fall back to instant preview
      const effectiveMode: AIEngineMode =
        aiModeRef.current === 'webgpu' && !localAI.getLoadedModelId()
          ? 'instant_preview'
          : aiModeRef.current;

      try {
        const result = await localAI.generateReply({
          mode: effectiveMode,
          personality: personalityRef.current,
          history: prevHistory,
          userText: trimmed,
          localServerUrl,
          localServerModel,
          apiConfig: apiConfigRef.current,
          onToken: (partial, partialMood) => {
            setStreamingText(partial);
            setMood(partialMood);
            sceneRef.current?.setMood(partialMood);
          },
        });

        sceneRef.current?.setThinking(false);
        setStreamingText('');
        setMood(result.mood);
        sceneRef.current?.setMood(result.mood);

        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.text,
          mood: result.mood,
          timestamp: Date.now(),
        };
        setMessages((m) => [...m, aiMsg]);
        speakWithLipSync(result.text);
      } catch (err) {
        sceneRef.current?.setThinking(false);
        setStreamingText('');
        const errText =
          err instanceof Error
            ? err.message
            : 'Could not reach the on-device AI engine.';
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Oops! ${errText}`,
          mood: 'surprised',
          timestamp: Date.now(),
        };
        setMood('surprised');
        sceneRef.current?.setMood('surprised');
        setMessages((m) => [...m, errMsg]);
      } finally {
        setIsGenerating(false);
      }
    },
    [localServerModel, localServerUrl, speakWithLipSync]
  );

  // Initialize 3D Three.js Anime Companion Scene
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const ctrl = new AnimeSceneController(container, initial.appearance);
    sceneRef.current = ctrl;

    ctrl.onHeadpat = () => {
      setMood('excited');
      ctrl.setMood('excited');
      if (!isGeneratingRef.current) {
        sendMessage('*pats your head gently*');
      }
    };

    ctrl.onPoke = () => {
      const tsun = personalityRef.current.tsundereLevel > 55;
      const m: Mood = tsun ? 'tsundere' : 'surprised';
      setMood(m);
      ctrl.setMood(m);
      if (!isGeneratingRef.current) {
        sendMessage('*pokes your cheek playfully*');
      }
    };

    ctrl.onVrmLoaded = (name) => {
      setVrmFileName(name);
      setMood('happy');
    };

    ctrl.onVrmError = (msg) => {
      setMessages((m) => [
        ...m,
        {
          id: `vrm-err-${Date.now()}`,
          role: 'assistant',
          content: `VRM load note: ${msg}`,
          mood: 'thoughtful',
          timestamp: Date.now(),
        },
      ]);
    };

    return () => {
      ctrl.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push appearance updates live to 3D rig
  useEffect(() => {
    sceneRef.current?.updateAppearance(appearance);
  }, [appearance]);

  const handleSelectPreset = (preset: CharacterPreset) => {
    setActivePresetId(preset.id);
    setAppearance(preset.appearance);
    setPersonality(preset.personality);
    setMood('happy');
    sceneRef.current?.setMood('happy');
    const greetMsg: ChatMessage = {
      id: `preset-${Date.now()}`,
      role: 'assistant',
      content: preset.greeting,
      mood: 'happy',
      timestamp: Date.now(),
    };
    setMessages([greetMsg]);
    if (preset.personality.autoSpeak) {
      voiceEngine.speak(preset.greeting, preset.personality, (s, e) => {
        setIsSpeaking(s);
        sceneRef.current?.setSpeaking(s, e);
      });
    }
  };

  const handleLoadWebLLM = async () => {
    setLoadingWebLLM(true);
    setLoadError(null);
    setLoadProgress(0);
    setLoadText('Preparing WebGPU pipeline...');
    try {
      await localAI.loadWebLLMModel(selectedModelId, (info) => {
        setLoadProgress(info.progress);
        setLoadText(info.text);
      });
      setLoadedModelId(selectedModelId);
      setAiMode('webgpu');
      setAiModalOpen(false);

      const readyLine = `Yay! My on-device neural brain (${selectedModelId.split('-')[0]}) is loaded right on your GPU! Let's talk!`;
      setMood('excited');
      sceneRef.current?.setMood('excited');
      setMessages((m) => [
        ...m,
        {
          id: `ready-${Date.now()}`,
          role: 'assistant',
          content: readyLine,
          mood: 'excited',
          timestamp: Date.now(),
        },
      ]);
      speakWithLipSync(readyLine);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to initialize WebGPU model.'
      );
    } finally {
      setLoadingWebLLM(false);
    }
  };

  const handleLoadKokoro = async () => {
    if (kokoroLoading) return;
    setKokoroLoading(true);
    setKokoroError(null);
    setKokoroProgress(0);
    setKokoroStatus('Starting Kokoro-82M neural voice...');
    try {
      await voiceEngine.loadKokoro((info) => {
        setKokoroProgress(info.progress);
        setKokoroStatus(info.status);
      });
      setKokoroLoaded(true);
      setPersonality((prev) => ({ ...prev, ttsEngine: 'kokoro' }));
      const sample = `Hi! My realistic neural voice is ready now. How do I sound?`;
      voiceEngine.speak(
        sample,
        { ...personalityRef.current, ttsEngine: 'kokoro' },
        (s, e) => {
          setIsSpeaking(s);
          sceneRef.current?.setSpeaking(s, e);
        }
      );
    } catch (err) {
      setKokoroError(
        err instanceof Error ? err.message : 'Failed to load Kokoro neural voice.'
      );
    } finally {
      setKokoroLoading(false);
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      voiceEngine.stopListening();
      setIsListening(false);
      return;
    }
    setIsListening(true);
    voiceEngine.startListening(
      (transcript, isFinal) => {
        setInputText(transcript);
        if (isFinal && transcript.trim()) {
          setIsListening(false);
          sendMessage(transcript);
        }
      },
      () => setIsListening(false),
      (err) => {
        setIsListening(false);
        setMessages((m) => [
          ...m,
          {
            id: `mic-err-${Date.now()}`,
            role: 'assistant',
            content: err,
            mood: 'thoughtful',
            timestamp: Date.now(),
          },
        ]);
      }
    );
  };

  const toggleCameraPreset = () => {
    const next = cameraPreset === 'portrait' ? 'full' : 'portrait';
    setCameraPreset(next);
    sceneRef.current?.setCameraPreset(next);
  };

  const latestAssistant =
    streamingText ||
    [...messages].reverse().find((m) => m.role === 'assistant')?.content ||
    '';

  const isApiReady = aiMode === 'api_key' && Boolean(apiConfig.apiKey.trim());

  const aiBadgeLabel =
    aiMode === 'webgpu' && loadedModelId
      ? `On-Device WebGPU · ${loadedModelId.split('-').slice(0, 2).join(' ')}`
      : aiMode === 'local_server'
      ? 'Local Server Connected'
      : isApiReady
      ? `API · ${apiConfig.model || API_PROVIDER_PRESETS[apiConfig.provider].label}`
      : 'Load On-Device AI';

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingVrm(true);
      }}
      onDragLeave={() => setDraggingVrm(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingVrm(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.toLowerCase().endsWith('.vrm')) {
          sceneRef.current?.loadVRMFile(f);
        }
      }}
    >
      {/* 3D Anime Stage */}
      <div ref={viewportRef} className="viewport-canvas-wrap" />

      {draggingVrm && (
        <div className="drop-overlay">Drop .VRM Anime Avatar Here</div>
      )}

      {/* Top Floating HUD */}
      <header className="top-hud">
        <div className="top-hud-group">
          <div className="character-badge glass-panel">
            <span className="avatar-dot" />
            <span className="char-name">{personality.name || 'Koko'}</span>
            <span className="mood-pill">{mood}</span>
          </div>

          <button
            type="button"
            className={`hud-btn ${loadedModelId || aiMode === 'local_server' || isApiReady ? 'active' : 'primary'}`}
            onClick={() => setAiModalOpen(true)}
          >
            <Cpu size={14} />
            {loadingWebLLM
              ? `Loading AI ${Math.round(loadProgress * 100)}%`
              : aiBadgeLabel}
          </button>

          <button
            type="button"
            className={`hud-btn ${kokoroLoaded ? 'active' : ''}`}
            disabled={kokoroLoading}
            onClick={handleLoadKokoro}
            title="Load realistic on-device Kokoro-82M neural TTS voice"
          >
            <Volume2 size={14} />
            {kokoroLoading
              ? `Voice ${Math.round(kokoroProgress * 100)}%`
              : kokoroLoaded
              ? 'Kokoro Neural Voice'
              : 'Load Neural Voice'}
          </button>
        </div>

        <div className="top-hud-group">
          <button
            type="button"
            className="hud-btn"
            onClick={toggleCameraPreset}
            title="Switch Portrait / Full Body view"
          >
            <Camera size={14} />
            {cameraPreset === 'portrait' ? 'Full Body' : 'Portrait'}
          </button>

          <button
            type="button"
            className={`hud-btn ${personality.autoSpeak ? 'active' : ''}`}
            onClick={() => {
              const nextSpeak = !personality.autoSpeak;
              if (!nextSpeak) {
                voiceEngine.stopSpeaking((s, e) => {
                  setIsSpeaking(s);
                  sceneRef.current?.setSpeaking(s, e);
                });
              }
              setPersonality({ ...personality, autoSpeak: nextSpeak });
            }}
            title="Toggle Voice Output"
          >
            {personality.autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {personality.autoSpeak ? 'Voice On' : 'Muted'}
          </button>

          <button
            type="button"
            className={`hud-btn ${drawerOpen ? 'active' : ''}`}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <SlidersHorizontal size={14} />
            {drawerOpen ? 'Hide Studio' : 'Customize'}
          </button>
        </div>
      </header>

      <div className="hint-toast glass-panel">
        Tip: Drag to orbit · Scroll to zoom · Click her head to pat!
      </div>

      {/* Right Customization Studio */}
      <CustomizerPanel
        open={drawerOpen}
        activePresetId={activePresetId}
        appearance={appearance}
        personality={personality}
        vrmFileName={vrmFileName}
        kokoroLoaded={kokoroLoaded}
        kokoroLoading={kokoroLoading}
        kokoroProgress={kokoroProgress}
        kokoroStatus={kokoroStatus}
        kokoroError={kokoroError}
        onLoadKokoro={handleLoadKokoro}
        onSelectPreset={handleSelectPreset}
        onChangeAppearance={(next) => {
          setActivePresetId(null);
          setAppearance(next);
        }}
        onChangePersonality={(next) => {
          setActivePresetId(null);
          setPersonality(next);
        }}
        onUploadVRM={(f) => sceneRef.current?.loadVRMFile(f)}
        onResetBuiltInModel={() => {
          sceneRef.current?.useBuiltInModel();
          setVrmFileName(null);
        }}
        onTestVoice={() =>
          voiceEngine.speak(
            `Hi! I'm ${personality.name}. How do I sound right now?`,
            personality,
            (s, e) => {
              setIsSpeaking(s);
              sceneRef.current?.setSpeaking(s, e);
            }
          )
        }
      />

      {/* Bottom Floating Dialogue & Chat Controls */}
      <section
        className={`chat-dock ${drawerOpen ? 'with-drawer' : ''}`}
        aria-label="Conversation"
      >
        {historyOpen && (
          <div className="history-popover glass-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--text-muted)',
              }}
            >
              <span>Conversation History</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 11.5,
                }}
              >
                Close
              </button>
            </div>
            <div className="history-scroll">
              {messages.map((m) => (
                <div key={m.id} className={`msg-row ${m.role}`}>
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="speech-bubble glass-panel">
          <div className="speech-header">
            <span className="speech-speaker">
              {personality.name || 'Koko'}
              {isGenerating
                ? ' · thinking...'
                : isSpeaking
                ? ' · speaking ♪'
                : ''}
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11.5,
              }}
            >
              <History size={13} />
              {historyOpen ? 'Hide Log' : `Log (${messages.length})`}
            </button>
          </div>
          <div className="speech-text">{latestAssistant}</div>
        </div>

        <div className="quick-actions">
          <button
            type="button"
            className="quick-chip"
            onClick={() => {
              sceneRef.current?.triggerHeadpatReaction();
            }}
          >
            <Hand size={13} /> Pat Head
          </button>
          <button
            type="button"
            className="quick-chip"
            onClick={() => sendMessage('Hey! How are you feeling today?')}
          >
            <Sparkles size={13} /> Say Hi
          </button>
          <button
            type="button"
            className="quick-chip"
            onClick={() => sendMessage('You look super cute today!')}
          >
            <Heart size={13} /> Compliment
          </button>
        </div>

        <form
          className="chat-input-bar glass-panel"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputText);
          }}
        >
          <button
            type="button"
            className={`icon-btn ${isListening ? 'recording' : ''}`}
            onClick={handleToggleMic}
            title={
              isListening ? 'Stop listening' : 'Talk with microphone (Voice)'
            }
          >
            {isListening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>

          <input
            type="text"
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Talk or type to ${personality.name || 'Koko'}...`}
            disabled={isGenerating}
          />

          <button
            type="submit"
            className="icon-btn send"
            disabled={isGenerating || !inputText.trim()}
            title="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </section>

      {/* On-Device AI Configuration Modal */}
      <AIEngineModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        mode={aiMode}
        onSelectMode={setAiMode}
        selectedModelId={selectedModelId}
        onSelectModelId={setSelectedModelId}
        loadedModelId={loadedModelId}
        loadingWebLLM={loadingWebLLM}
        loadProgress={loadProgress}
        loadText={loadText}
        loadError={loadError}
        onLoadWebLLM={handleLoadWebLLM}
        localServerUrl={localServerUrl}
        onChangeLocalServerUrl={setLocalServerUrl}
        localServerModel={localServerModel}
        onChangeLocalServerModel={setLocalServerModel}
        apiConfig={apiConfig}
        onChangeApiConfig={setApiConfig}
      />
    </div>
  );
}

export default App;
