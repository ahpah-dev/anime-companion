export type HairStyle =
  | 'twintails'
  | 'long_hime'
  | 'ponytail'
  | 'bob_ahoge'
  | 'half_buns';

export type EyeStyle =
  | 'sparkle'
  | 'starry'
  | 'sharp_tsun'
  | 'gentle'
  | 'cat_iris';

export type SkinTone = 'porcelain' | 'peach' | 'warm' | 'tan';

export type OutfitStyle =
  | 'sailor_uniform'
  | 'cozy_hoodie'
  | 'maid_frill'
  | 'cyber_jacket'
  | 'idol_dress'
  | 'magical_girl'
  | 'gothic_lolita'
  | 'kimono_modern'
  | 'shrine_miko'
  | 'angel_valkyrie'
  | 'bunny_stage';

export type AccessoryType =
  | 'none'
  | 'cat_ears'
  | 'ribbons'
  | 'halo'
  | 'glasses'
  | 'headphones';

export type SceneTheme =
  | 'sakura_room'
  | 'cyber_loft'
  | 'starlight_stage'
  | 'sunset_rooftop';

export type PersonalityArchetype =
  | 'genki'
  | 'tsundere'
  | 'kuudere'
  | 'dandere'
  | 'oneesan'
  | 'custom';

export type SpeakingStyle =
  | 'casual'
  | 'anime_jp_mix'
  | 'poetic'
  | 'snappy';

export type Mood =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'shy'
  | 'tsundere'
  | 'thoughtful'
  | 'surprised'
  | 'sleepy';

export type AIEngineMode =
  | 'webgpu'
  | 'local_server'
  | 'api_key'
  | 'instant_preview';

export type ApiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'custom';

export interface ApiKeyConfig {
  provider: ApiProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  rememberKey: boolean;
}

export interface AppearanceConfig {
  hairStyle: HairStyle;
  hairColor: string;
  hairHighlightColor: string;
  eyeStyle: EyeStyle;
  eyeColor: string;
  eyeScale: number;
  skinTone: SkinTone;
  blushIntensity: number;
  outfitStyle: OutfitStyle;
  outfitPrimaryColor: string;
  outfitSecondaryColor: string;
  outfitAccentColor: string;
  accessory: AccessoryType;
  sceneTheme: SceneTheme;
}

export type TTSEngineMode = 'kokoro' | 'browser' | 'openai_tts' | 'elevenlabs';

export interface PersonalityConfig {
  name: string;
  archetype: PersonalityArchetype;
  warmth: number;
  playfulness: number;
  tsundereLevel: number;
  expressiveness: number;
  speakingStyle: SpeakingStyle;
  customPrompt: string;
  ttsEngine: TTSEngineMode;
  kokoroVoice: string;
  ttsApiKey: string;
  ttsCloudVoice: string;
  voicePitch: number;
  voiceRate: number;
  voiceName: string;
  autoSpeak: boolean;
}

export interface CharacterPreset {
  id: string;
  label: string;
  tagline: string;
  appearance: AppearanceConfig;
  personality: PersonalityConfig;
  greeting: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: Mood;
  timestamp: number;
}

export interface WebLLMModelOption {
  id: string;
  label: string;
  sizeNote: string;
  vramMB: number;
}
