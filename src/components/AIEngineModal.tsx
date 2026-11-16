import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Server,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { API_PROVIDER_PRESETS, WEBLLM_MODELS } from '../data/presets';
import { AIEngineMode, ApiKeyConfig, ApiProviderId } from '../types/companion';

interface AIEngineModalProps {
  open: boolean;
  onClose: () => void;
  mode: AIEngineMode;
  onSelectMode: (mode: AIEngineMode) => void;
  selectedModelId: string;
  onSelectModelId: (id: string) => void;
  loadedModelId: string | null;
  loadingWebLLM: boolean;
  loadProgress: number;
  loadText: string;
  loadError: string | null;
  onLoadWebLLM: () => void;
  localServerUrl: string;
  onChangeLocalServerUrl: (v: string) => void;
  localServerModel: string;
  onChangeLocalServerModel: (v: string) => void;
  apiConfig: ApiKeyConfig;
  onChangeApiConfig: (next: ApiKeyConfig) => void;
}

export const AIEngineModal: React.FC<AIEngineModalProps> = ({
  open,
  onClose,
  mode,
  onSelectMode,
  selectedModelId,
  onSelectModelId,
  loadedModelId,
  loadingWebLLM,
  loadProgress,
  loadText,
  loadError,
  onLoadWebLLM,
  localServerUrl,
  onChangeLocalServerUrl,
  localServerModel,
  onChangeLocalServerModel,
  apiConfig,
  onChangeApiConfig,
}) => {
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  const providerPreset = API_PROVIDER_PRESETS[apiConfig.provider];

  const handleSelectProvider = (provider: ApiProviderId) => {
    const p = API_PROVIDER_PRESETS[provider];
    onChangeApiConfig({
      ...apiConfig,
      provider,
      baseUrl: p.baseUrl,
      model: p.defaultModel,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card glass-panel"
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              AI Brain Settings
            </h2>
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--text-muted)',
                marginTop: 2,
              }}
            >
              Run 100% on-device via WebGPU or Local Server — or add an optional
              API key.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="chip-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <button
            type="button"
            className={`option-chip ${mode === 'webgpu' ? 'active' : ''}`}
            onClick={() => onSelectMode('webgpu')}
          >
            <Cpu size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            WebGPU
          </button>
          <button
            type="button"
            className={`option-chip ${mode === 'local_server' ? 'active' : ''}`}
            onClick={() => onSelectMode('local_server')}
          >
            <Server size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            Local
          </button>
          <button
            type="button"
            className={`option-chip ${mode === 'api_key' ? 'active' : ''}`}
            onClick={() => onSelectMode('api_key')}
          >
            <KeyRound size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            API Key
          </button>
          <button
            type="button"
            className={`option-chip ${mode === 'instant_preview' ? 'active' : ''}`}
            onClick={() => onSelectMode('instant_preview')}
          >
            <Sparkles size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            Preview
          </button>
        </div>

        {mode === 'webgpu' && (
          <div className="section-block">
            <div className="section-title">
              <span>Select On-Device WebGPU Model (Zero API Key)</span>
              {loadedModelId && (
                <span style={{ color: '#6ee7b7', fontWeight: 600 }}>
                  <CheckCircle2
                    size={12}
                    style={{ marginRight: 4, verticalAlign: '-2px' }}
                  />
                  Loaded
                </span>
              )}
            </div>

            <div
              className="history-scroll"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                maxHeight: 265,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {WEBLLM_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`preset-card ${selectedModelId === m.id ? 'active' : ''}`}
                  onClick={() => onSelectModelId(m.id)}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {m.sizeNote} · Cached locally after first load
                    </div>
                  </div>
                  {loadedModelId === m.id && (
                    <CheckCircle2 size={16} color="#6ee7b7" />
                  )}
                </button>
              ))}
            </div>

            {loadingWebLLM && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.round(loadProgress * 100)}%` }}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {loadText} ({Math.round(loadProgress * 100)}%)
                </div>
              </div>
            )}

            {loadError && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.16)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontSize: 12,
                  color: '#fecaca',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{loadError}</span>
              </div>
            )}

            <button
              type="button"
              className="hud-btn primary"
              style={{
                justifyContent: 'center',
                padding: '11px 16px',
                marginTop: 4,
              }}
              disabled={loadingWebLLM}
              onClick={onLoadWebLLM}
            >
              <Cpu size={15} />
              {loadingWebLLM
                ? 'Downloading & Compiling Shaders on GPU...'
                : loadedModelId === selectedModelId
                ? 'Model Ready on GPU'
                : 'Load Selected Model On-Device'}
            </button>
          </div>
        )}

        {mode === 'local_server' && (
          <div className="section-block">
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Connect to any local OpenAI-compatible server on your machine —
              for example <code>llama-server.exe --port 8080 -ngl 99</code> or{' '}
              <code>ollama serve</code> (<code>http://127.0.0.1:11434/v1</code>).
            </p>
            <div className="section-title">Endpoint Base URL</div>
            <input
              type="text"
              className="text-input"
              value={localServerUrl}
              onChange={(e) => onChangeLocalServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080/v1"
            />
            <div className="section-title">Model Name (for Ollama / llama.cpp)</div>
            <input
              type="text"
              className="text-input"
              value={localServerModel}
              onChange={(e) => onChangeLocalServerModel(e.target.value)}
              placeholder="local-model (or e.g. qwen3:8b)"
            />
          </div>
        )}

        {mode === 'api_key' && (
          <div className="section-block">
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.45,
              }}
            >
              <strong>Completely optional:</strong> connect a cloud API key if
              you want cloud speed or larger models, or leave blank and use{' '}
              <strong>WebGPU</strong> / <strong>Local</strong> for 100% on-device
              privacy.
            </p>

            <div className="section-title">Provider</div>
            <div className="chip-grid three">
              {(Object.keys(API_PROVIDER_PRESETS) as ApiProviderId[]).map(
                (pid) => (
                  <button
                    key={pid}
                    type="button"
                    className={`option-chip ${apiConfig.provider === pid ? 'active' : ''}`}
                    onClick={() => handleSelectProvider(pid)}
                  >
                    {API_PROVIDER_PRESETS[pid].label}
                  </button>
                )
              )}
            </div>

            <div className="section-title">
              <span>API Key (Optional)</span>
              {apiConfig.apiKey && (
                <button
                  type="button"
                  onClick={() =>
                    onChangeApiConfig({ ...apiConfig, apiKey: '' })
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  <Trash2 size={11} /> Clear Key
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="text-input"
                value={apiConfig.apiKey}
                onChange={(e) =>
                  onChangeApiConfig({ ...apiConfig, apiKey: e.target.value })
                }
                placeholder={providerPreset.placeholderKey}
                autoComplete="off"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowKey((s) => !s)}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div className="section-title">Model</div>
            {providerPreset.suggestedModels.length > 0 && (
              <div className="swatch-row" style={{ marginBottom: 4 }}>
                {providerPreset.suggestedModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`option-chip ${apiConfig.model === m ? 'active' : ''}`}
                    style={{ padding: '5px 9px', fontSize: 11.5 }}
                    onClick={() => onChangeApiConfig({ ...apiConfig, model: m })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              className="text-input"
              value={apiConfig.model}
              onChange={(e) =>
                onChangeApiConfig({ ...apiConfig, model: e.target.value })
              }
              placeholder="Model ID (e.g. gemini-2.5-flash, gpt-4.1-mini)"
            />

            <div className="section-title">Base URL</div>
            <input
              type="text"
              className="text-input"
              value={apiConfig.baseUrl}
              onChange={(e) =>
                onChangeApiConfig({ ...apiConfig, baseUrl: e.target.value })
              }
              placeholder={providerPreset.baseUrl}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              <input
                type="checkbox"
                checked={apiConfig.rememberKey}
                onChange={(e) =>
                  onChangeApiConfig({
                    ...apiConfig,
                    rememberKey: e.target.checked,
                  })
                }
              />
              Save API key locally in this browser (localStorage)
            </label>

            <button
              type="button"
              className="hud-btn primary"
              style={{ justifyContent: 'center', padding: '10px 14px', marginTop: 4 }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

        {mode === 'instant_preview' && (
          <div className="section-block">
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Quick Preview uses a lightweight built-in conversational responder
              so you can test her voice, lip-sync, headpats, and expressions
              immediately with zero download. Switch to <strong>WebGPU</strong>,{' '}
              <strong>Local</strong>, or <strong>API Key</strong> anytime!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
