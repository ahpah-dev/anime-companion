import React, { useEffect, useState } from 'react';
import {
  Palette,
  Sparkles,
  UserCheck,
  Volume2,
  Upload,
  RotateCcw,
} from 'lucide-react';
import {
  CHARACTER_PRESETS,
  EYE_SWATCHES,
  HAIR_SWATCHES,
  KOKORO_VOICES,
  OUTFIT_PALETTES,
  SKIN_PALETTES,
} from '../data/presets';
import {
  AccessoryType,
  AppearanceConfig,
  CharacterPreset,
  EyeStyle,
  HairStyle,
  OutfitStyle,
  PersonalityArchetype,
  PersonalityConfig,
  SceneTheme,
  SkinTone,
  SpeakingStyle,
  TTSEngineMode,
} from '../types/companion';
import { voiceEngine } from '../services/voiceEngine';

interface CustomizerPanelProps {
  open: boolean;
  activePresetId: string | null;
  appearance: AppearanceConfig;
  personality: PersonalityConfig;
  vrmFileName: string | null;
  kokoroLoaded: boolean;
  kokoroLoading: boolean;
  kokoroProgress: number;
  kokoroStatus: string;
  kokoroError: string | null;
  onLoadKokoro: () => void;
  onSelectPreset: (preset: CharacterPreset) => void;
  onChangeAppearance: (next: AppearanceConfig) => void;
  onChangePersonality: (next: PersonalityConfig) => void;
  onUploadVRM: (file: File) => void;
  onResetBuiltInModel: () => void;
  onTestVoice: () => void;
}

type TabKey = 'presets' | 'appearance' | 'personality';

const HAIR_OPTIONS: { id: HairStyle; label: string }[] = [
  { id: 'twintails', label: 'Twin-Tails' },
  { id: 'long_hime', label: 'Long Hime' },
  { id: 'ponytail', label: 'High Ponytail' },
  { id: 'bob_ahoge', label: 'Cute Bob' },
  { id: 'half_buns', label: 'Twin Buns' },
];

const EYE_OPTIONS: { id: EyeStyle; label: string }[] = [
  { id: 'starry', label: 'Starry' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'sharp_tsun', label: 'Sharp Tsun' },
  { id: 'gentle', label: 'Gentle' },
  { id: 'cat_iris', label: 'Cat Iris' },
];

const OUTFIT_OPTIONS: { id: OutfitStyle; label: string }[] = [
  { id: 'sailor_uniform', label: 'Sailor Uniform' },
  { id: 'cozy_hoodie', label: 'Cozy Hoodie' },
  { id: 'maid_frill', label: 'Maid Frill' },
  { id: 'cyber_jacket', label: 'Cyber Jacket' },
  { id: 'idol_dress', label: 'Idol Dress' },
  { id: 'magical_girl', label: 'Magical Girl' },
  { id: 'gothic_lolita', label: 'Gothic Lolita' },
  { id: 'kimono_modern', label: 'Neo Kimono' },
  { id: 'shrine_miko', label: 'Shrine Maiden' },
  { id: 'angel_valkyrie', label: 'Sky Valkyrie' },
  { id: 'bunny_stage', label: 'Stage Bunny' },
];

const ACCESSORY_OPTIONS: { id: AccessoryType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'cat_ears', label: 'Cat Ears' },
  { id: 'ribbons', label: 'Twin Ribbons' },
  { id: 'halo', label: 'Star Halo' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'headphones', label: 'Headphones' },
];

const THEME_OPTIONS: { id: SceneTheme; label: string }[] = [
  { id: 'sakura_room', label: 'Sakura Twilight' },
  { id: 'cyber_loft', label: 'Cyber Neon' },
  { id: 'starlight_stage', label: 'Starlight Stage' },
  { id: 'sunset_rooftop', label: 'Sunset Rooftop' },
];

const ARCHETYPE_OPTIONS: { id: PersonalityArchetype; label: string }[] = [
  { id: 'genki', label: 'Genki (Sunny)' },
  { id: 'tsundere', label: 'Tsundere' },
  { id: 'kuudere', label: 'Kuudere (Cool)' },
  { id: 'dandere', label: 'Dandere (Shy)' },
  { id: 'oneesan', label: 'Onee-san' },
  { id: 'custom', label: 'Custom' },
];

const SPEAKING_STYLES: { id: SpeakingStyle; label: string }[] = [
  { id: 'anime_jp_mix', label: 'Anime Mix' },
  { id: 'casual', label: 'Casual Bestie' },
  { id: 'poetic', label: 'Poetic' },
  { id: 'snappy', label: 'Snappy Wit' },
];

export const CustomizerPanel: React.FC<CustomizerPanelProps> = ({
  open,
  activePresetId,
  appearance,
  personality,
  vrmFileName,
  kokoroLoaded,
  kokoroLoading,
  kokoroProgress,
  kokoroStatus,
  kokoroError,
  onLoadKokoro,
  onSelectPreset,
  onChangeAppearance,
  onChangePersonality,
  onUploadVRM,
  onResetBuiltInModel,
  onTestVoice,
}) => {
  const [tab, setTab] = useState<TabKey>('appearance');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const refresh = () => setVoices(voiceEngine.getAvailableVoices());
    refresh();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
  }, []);

  const setApp = <K extends keyof AppearanceConfig>(
    key: K,
    val: AppearanceConfig[K]
  ) => {
    onChangeAppearance({ ...appearance, [key]: val });
  };

  const setPers = <K extends keyof PersonalityConfig>(
    key: K,
    val: PersonalityConfig[K]
  ) => {
    onChangePersonality({ ...personality, [key]: val });
  };

  return (
    <aside
      className={`customizer-drawer glass-panel ${open ? '' : 'collapsed'}`}
      aria-label="Character Customization Studio"
    >
      <div className="drawer-tabs">
        <button
          type="button"
          className={`drawer-tab ${tab === 'presets' ? 'active' : ''}`}
          onClick={() => setTab('presets')}
        >
          <Sparkles size={14} /> Presets
        </button>
        <button
          type="button"
          className={`drawer-tab ${tab === 'appearance' ? 'active' : ''}`}
          onClick={() => setTab('appearance')}
        >
          <Palette size={14} /> Look
        </button>
        <button
          type="button"
          className={`drawer-tab ${tab === 'personality' ? 'active' : ''}`}
          onClick={() => setTab('personality')}
        >
          <UserCheck size={14} /> Persona
        </button>
      </div>

      <div className="drawer-body">
        {tab === 'presets' && (
          <>
            <div className="section-block">
              <div className="section-title">Character Presets</div>
              {CHARACTER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-card ${activePresetId === p.id ? 'active' : ''}`}
                  onClick={() => onSelectPreset(p)}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#fff',
                      }}
                    >
                      {p.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {p.tagline}
                    </div>
                  </div>
                  <div className="preset-swatch-preview">
                    <span
                      className="preset-dot"
                      style={{ background: p.appearance.hairColor }}
                    />
                    <span
                      className="preset-dot"
                      style={{ background: p.appearance.eyeColor }}
                    />
                    <span
                      className="preset-dot"
                      style={{ background: p.appearance.outfitPrimaryColor }}
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="section-block">
              <div className="section-title">Custom .VRM Avatar (Optional)</div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                }}
              >
                You can also drag &amp; drop any VRoid <code>.vrm</code> model
                onto the stage, or upload one here.
              </p>
              <label
                className="hud-btn"
                style={{ justifyContent: 'center', borderRadius: 12 }}
              >
                <Upload size={14} />
                {vrmFileName ? `Loaded: ${vrmFileName}` : 'Upload .VRM Model'}
                <input
                  type="file"
                  accept=".vrm"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadVRM(f);
                  }}
                />
              </label>
              {vrmFileName && (
                <button
                  type="button"
                  className="option-chip"
                  onClick={onResetBuiltInModel}
                >
                  <RotateCcw
                    size={12}
                    style={{ marginRight: 6, verticalAlign: '-1px' }}
                  />
                  Switch back to Customizable 3D Model
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'appearance' && (
          <>
            <div className="section-block">
              <div className="section-title">Hairstyle</div>
              <div className="chip-grid">
                {HAIR_OPTIONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`option-chip ${appearance.hairStyle === h.id ? 'active' : ''}`}
                    onClick={() => setApp('hairStyle', h.id)}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Hair Color &amp; Sheen</div>
              <div className="swatch-row">
                {HAIR_SWATCHES.map((sw) => (
                  <button
                    key={sw.label}
                    type="button"
                    title={sw.label}
                    className={`swatch-btn ${appearance.hairColor === sw.base ? 'active' : ''}`}
                    style={{ background: sw.base }}
                    onClick={() =>
                      onChangeAppearance({
                        ...appearance,
                        hairColor: sw.base,
                        hairHighlightColor: sw.highlight,
                      })
                    }
                  />
                ))}
                <label className="color-input-pill">
                  <input
                    type="color"
                    value={appearance.hairColor}
                    onChange={(e) => setApp('hairColor', e.target.value)}
                  />
                  Custom
                </label>
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Eye Style &amp; Color</div>
              <div className="chip-grid three">
                {EYE_OPTIONS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`option-chip ${appearance.eyeStyle === e.id ? 'active' : ''}`}
                    onClick={() => setApp('eyeStyle', e.id)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <div className="swatch-row">
                {EYE_SWATCHES.map((sw) => (
                  <button
                    key={sw.label}
                    type="button"
                    title={sw.label}
                    className={`swatch-btn ${appearance.eyeColor === sw.color ? 'active' : ''}`}
                    style={{ background: sw.color }}
                    onClick={() => setApp('eyeColor', sw.color)}
                  />
                ))}
                <label className="color-input-pill">
                  <input
                    type="color"
                    value={appearance.eyeColor}
                    onChange={(e) => setApp('eyeColor', e.target.value)}
                  />
                  Custom
                </label>
              </div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Eye Size</span>
                  <strong>{Math.round(appearance.eyeScale * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.85}
                  max={1.18}
                  step={0.01}
                  value={appearance.eyeScale}
                  onChange={(e) =>
                    setApp('eyeScale', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Skin Tone &amp; Blush</div>
              <div className="swatch-row">
                {(Object.keys(SKIN_PALETTES) as SkinTone[]).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    title={tone}
                    className={`swatch-btn ${appearance.skinTone === tone ? 'active' : ''}`}
                    style={{ background: SKIN_PALETTES[tone].base }}
                    onClick={() => setApp('skinTone', tone)}
                  />
                ))}
              </div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Blush Glow</span>
                  <strong>{Math.round(appearance.blushIntensity * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={appearance.blushIntensity}
                  onChange={(e) =>
                    setApp('blushIntensity', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Outfit &amp; Palette</div>
              <div className="chip-grid">
                {OUTFIT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`option-chip ${appearance.outfitStyle === o.id ? 'active' : ''}`}
                    onClick={() => setApp('outfitStyle', o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="swatch-row" style={{ marginTop: 4 }}>
                <label className="color-input-pill">
                  <input
                    type="color"
                    value={appearance.outfitPrimaryColor}
                    onChange={(e) =>
                      setApp('outfitPrimaryColor', e.target.value)
                    }
                  />
                  Primary
                </label>
                <label className="color-input-pill">
                  <input
                    type="color"
                    value={appearance.outfitSecondaryColor}
                    onChange={(e) =>
                      setApp('outfitSecondaryColor', e.target.value)
                    }
                  />
                  Secondary
                </label>
                <label className="color-input-pill">
                  <input
                    type="color"
                    value={appearance.outfitAccentColor}
                    onChange={(e) =>
                      setApp('outfitAccentColor', e.target.value)
                    }
                  />
                  Accent
                </label>
              </div>
              <div className="swatch-row" style={{ marginTop: 4 }}>
                {OUTFIT_PALETTES.map((pal) => (
                  <button
                    key={pal.label}
                    type="button"
                    className="option-chip"
                    style={{
                      padding: '4px 9px',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    onClick={() =>
                      onChangeAppearance({
                        ...appearance,
                        outfitPrimaryColor: pal.primary,
                        outfitSecondaryColor: pal.secondary,
                        outfitAccentColor: pal.accent,
                      })
                    }
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: pal.primary,
                        border: '1px solid rgba(255,255,255,0.4)',
                      }}
                    />
                    {pal.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Accessory</div>
              <div className="chip-grid three">
                {ACCESSORY_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`option-chip ${appearance.accessory === a.id ? 'active' : ''}`}
                    onClick={() => setApp('accessory', a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">3D Stage Backdrop</div>
              <div className="chip-grid">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`option-chip ${appearance.sceneTheme === t.id ? 'active' : ''}`}
                    onClick={() => setApp('sceneTheme', t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'personality' && (
          <>
            <div className="section-block">
              <div className="section-title">Name</div>
              <input
                type="text"
                className="text-input"
                maxLength={24}
                value={personality.name}
                onChange={(e) => setPers('name', e.target.value)}
                placeholder="Companion Name"
              />
            </div>

            <div className="section-block">
              <div className="section-title">Personality Archetype</div>
              <div className="chip-grid">
                {ARCHETYPE_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`option-chip ${personality.archetype === a.id ? 'active' : ''}`}
                    onClick={() => setPers('archetype', a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Trait Tuning</div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Warmth &amp; Affection</span>
                  <strong>{personality.warmth}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={personality.warmth}
                  onChange={(e) => setPers('warmth', Number(e.target.value))}
                />
              </div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Playfulness</span>
                  <strong>{personality.playfulness}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={personality.playfulness}
                  onChange={(e) =>
                    setPers('playfulness', Number(e.target.value))
                  }
                />
              </div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Tsundere Spice</span>
                  <strong>{personality.tsundereLevel}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={personality.tsundereLevel}
                  onChange={(e) =>
                    setPers('tsundereLevel', Number(e.target.value))
                  }
                />
              </div>
              <div className="slider-row">
                <div className="slider-label">
                  <span>Expressiveness</span>
                  <strong>{personality.expressiveness}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={personality.expressiveness}
                  onChange={(e) =>
                    setPers('expressiveness', Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Speaking Style</div>
              <div className="chip-grid">
                {SPEAKING_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`option-chip ${personality.speakingStyle === s.id ? 'active' : ''}`}
                    onClick={() => setPers('speakingStyle', s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-block">
              <div className="section-title">Custom Backstory / Instructions</div>
              <textarea
                className="textarea-input"
                value={personality.customPrompt}
                onChange={(e) => setPers('customPrompt', e.target.value)}
                placeholder="Describe her quirks, hobbies, or how she treats you..."
              />
            </div>

            <div className="section-block">
              <div className="section-title">
                <span>Realistic Voice &amp; Lip-Sync</span>
                <button
                  type="button"
                  className="option-chip"
                  style={{ padding: '4px 10px' }}
                  onClick={onTestVoice}
                >
                  <Volume2
                    size={12}
                    style={{ marginRight: 5, verticalAlign: '-2px' }}
                  />
                  Test Voice
                </button>
              </div>

              <div className="chip-grid">
                {(
                  [
                    { id: 'kokoro', label: 'Kokoro 82M (Local)' },
                    { id: 'openai_tts', label: 'OpenAI TTS (Key)' },
                    { id: 'elevenlabs', label: 'ElevenLabs (Key)' },
                    { id: 'browser', label: 'Browser Voice' },
                  ] as { id: TTSEngineMode; label: string }[]
                ).map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    className={`option-chip ${personality.ttsEngine === eng.id ? 'active' : ''}`}
                    onClick={() => setPers('ttsEngine', eng.id)}
                  >
                    {eng.label}
                  </button>
                ))}
              </div>

              {personality.ttsEngine === 'kokoro' && (
                <>
                  <button
                    type="button"
                    className={`hud-btn ${kokoroLoaded ? 'active' : 'primary'}`}
                    style={{
                      justifyContent: 'center',
                      borderRadius: 12,
                      padding: '9px 12px',
                    }}
                    disabled={kokoroLoading}
                    onClick={onLoadKokoro}
                  >
                    {kokoroLoading
                      ? `Loading Neural Voice (${Math.round(kokoroProgress * 100)}%)...`
                      : kokoroLoaded
                      ? '✓ Kokoro-82M Neural Voice Active'
                      : 'Load Realistic Neural Voice (Kokoro 82M)'}
                  </button>

                  {kokoroLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.round(kokoroProgress * 100)}%` }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {kokoroStatus}
                      </span>
                    </div>
                  )}

                  {kokoroError && (
                    <span style={{ fontSize: 11.5, color: '#fecaca' }}>
                      {kokoroError}
                    </span>
                  )}

                  <select
                    className="select-input"
                    value={personality.kokoroVoice || 'af_heart'}
                    onChange={(e) => setPers('kokoroVoice', e.target.value)}
                  >
                    {KOKORO_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} — {v.note}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {(personality.ttsEngine === 'openai_tts' ||
                personality.ttsEngine === 'elevenlabs') && (
                <>
                  <input
                    type="password"
                    className="text-input"
                    value={personality.ttsApiKey || ''}
                    onChange={(e) => setPers('ttsApiKey', e.target.value)}
                    placeholder={
                      personality.ttsEngine === 'openai_tts'
                        ? 'OpenAI API Key (sk-...)'
                        : 'ElevenLabs API Key'
                    }
                  />
                  {personality.ttsEngine === 'openai_tts' ? (
                    <select
                      className="select-input"
                      value={personality.ttsCloudVoice || 'nova'}
                      onChange={(e) => setPers('ttsCloudVoice', e.target.value)}
                    >
                      <option value="nova">Nova (Warm &amp; Expressive)</option>
                      <option value="shimmer">Shimmer (Bright &amp; Clear)</option>
                      <option value="coral">Coral (Friendly &amp; Lively)</option>
                      <option value="sage">Sage (Calm &amp; Poised)</option>
                      <option value="alloy">Alloy (Balanced)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="text-input"
                      value={personality.ttsCloudVoice || ''}
                      onChange={(e) => setPers('ttsCloudVoice', e.target.value)}
                      placeholder="ElevenLabs Voice ID (blank = Rachel)"
                    />
                  )}
                </>
              )}

              {personality.ttsEngine === 'browser' && (
                <>
                  <select
                    className="select-input"
                    value={personality.voiceName}
                    onChange={(e) => setPers('voiceName', e.target.value)}
                  >
                    <option value="">Auto-Select Best System Voice</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                  <div className="slider-row">
                    <div className="slider-label">
                      <span>Voice Pitch</span>
                      <strong>{personality.voicePitch.toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0.85}
                      max={1.45}
                      step={0.02}
                      value={personality.voicePitch}
                      onChange={(e) =>
                        setPers('voicePitch', parseFloat(e.target.value))
                      }
                    />
                  </div>
                </>
              )}

              <div className="slider-row">
                <div className="slider-label">
                  <span>Speaking Speed</span>
                  <strong>{personality.voiceRate.toFixed(2)}x</strong>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.35}
                  step={0.02}
                  value={personality.voiceRate}
                  onChange={(e) =>
                    setPers('voiceRate', parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
