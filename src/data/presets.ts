import {
  ApiProviderId,
  CharacterPreset,
  SkinTone,
  WebLLMModelOption,
} from '../types/companion';

export const SKIN_PALETTES: Record<
  SkinTone,
  { base: string; shadow: string; blush: string; lip: string; outline: string }
> = {
  porcelain: {
    base: '#fff0ea',
    shadow: '#f2cfc6',
    blush: '#ff8da6',
    lip: '#f28b99',
    outline: '#5c3b49',
  },
  peach: {
    base: '#ffe4d6',
    shadow: '#f0baa5',
    blush: '#ff7d95',
    lip: '#e87c8a',
    outline: '#5b3742',
  },
  warm: {
    base: '#f7d2ba',
    shadow: '#dfa384',
    blush: '#ff7888',
    lip: '#d96d7a',
    outline: '#56313a',
  },
  tan: {
    base: '#e3b290',
    shadow: '#c08261',
    blush: '#ff6f7d',
    lip: '#c7616f',
    outline: '#4c2b2f',
  },
};

export const HAIR_SWATCHES = [
  { label: 'Sakura Pink', base: '#ff9ec4', highlight: '#ffd7ea' },
  { label: 'Midnight Indigo', base: '#2a2d54', highlight: '#6572b8' },
  { label: 'Silver Frost', base: '#dce6f7', highlight: '#ffffff' },
  { label: 'Honey Caramel', base: '#d9915b', highlight: '#ffd4a6' },
  { label: 'Lavender Mist', base: '#b494ff', highlight: '#e7dbff' },
  { label: 'Crimson Rose', base: '#b83254', highlight: '#ff82a1' },
  { label: 'Mint Breeze', base: '#6fe0c7', highlight: '#cbfff3' },
  { label: 'Starlight Blonde', base: '#ffe07d', highlight: '#fff7c9' },
];

export const EYE_SWATCHES = [
  { label: 'Magenta Star', color: '#e94f9b' },
  { label: 'Amber Gold', color: '#f59e0b' },
  { label: 'Glacier Cyan', color: '#38bdf8' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Violet', color: '#9333ea' },
  { label: 'Ruby', color: '#ef4444' },
];

export const OUTFIT_PALETTES = [
  { label: 'Sakura', primary: '#ff7eb6', secondary: '#fff5fa', accent: '#fde047' },
  { label: 'Gothic', primary: '#1e192b', secondary: '#f3e8ff', accent: '#e11d48' },
  { label: 'Shrine', primary: '#dc2626', secondary: '#fffaf5', accent: '#f59e0b' },
  { label: 'Valkyrie', primary: '#eef4ff', secondary: '#3b82f6', accent: '#fbbf24' },
  { label: 'Cyber', primary: '#1b1f38', secondary: '#2d355a', accent: '#22d3ee' },
  { label: 'Midnight', primary: '#2d1c4d', secondary: '#fff1f8', accent: '#c084fc' },
];

export const WEBLLM_MODELS: WebLLMModelOption[] = [
  {
    id: 'Qwen3.5-2B-q4f16_1-MLC',
    label: 'Qwen 3.5 2B (Recommended · Fast & Smart)',
    sizeNote: '~2.2 GB VRAM · Latest Qwen 3.5',
    vramMB: 2245,
  },
  {
    id: 'Qwen3.5-4B-q4f16_1-MLC',
    label: 'Qwen 3.5 4B (Rich Roleplay)',
    sizeNote: '~3.9 GB VRAM · Latest Qwen 3.5',
    vramMB: 3868,
  },
  {
    id: 'gemma-4-E2B-it-q4f16_1-MLC',
    label: 'Gemma 4 E2B Instruct (Google Latest)',
    sizeNote: '~3.4 GB VRAM · Google Gemma 4',
    vramMB: 3387,
  },
  {
    id: 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC',
    label: 'Ministral 3 3B Instruct (Mistral)',
    sizeNote: '~2.9 GB VRAM · Expressive & Crisp',
    vramMB: 2864,
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    label: 'Phi-4 Mini Instruct (Microsoft)',
    sizeNote: '~3.4 GB VRAM · Sharp Reasoning',
    vramMB: 3438,
  },
  {
    id: 'Qwen3.5-9B-q4f16_1-MLC',
    label: 'Qwen 3.5 9B (Desktop GPU Pro)',
    sizeNote: '~6.4 GB VRAM · RTX 4060/5070+',
    vramMB: 6433,
  },
  {
    id: 'Qwen3.5-0.8B-q4f16_1-MLC',
    label: 'Qwen 3.5 0.8B (Fast Download)',
    sizeNote: '~1.6 GB VRAM · Lightweight',
    vramMB: 1629,
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    label: 'Gemma 3 1B Instruct (Ultra Light)',
    sizeNote: '~0.7 GB VRAM · Smallest Footprint',
    vramMB: 711,
  },
];

export const API_PROVIDER_PRESETS: Record<
  ApiProviderId,
  {
    label: string;
    baseUrl: string;
    defaultModel: string;
    suggestedModels: string[];
    placeholderKey: string;
  }
> = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
    placeholderKey: 'AIza...',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    suggestedModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini'],
    placeholderKey: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    suggestedModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    placeholderKey: 'sk-ant-...',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    suggestedModels: [
      'google/gemini-2.5-flash',
      'anthropic/claude-sonnet-4.5',
      'qwen/qwen3-32b',
    ],
    placeholderKey: 'sk-or-...',
  },
  custom: {
    label: 'Custom OpenAI API',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    suggestedModels: [],
    placeholderKey: 'Your API key...',
  },
};

export const KOKORO_VOICES: { id: string; label: string; note: string }[] = [
  { id: 'af_heart', label: 'Heart (Warm & Expressive)', note: 'Grade A · Best all-round' },
  { id: 'af_bella', label: 'Bella (Bright & Lively)', note: 'Grade A- · Energetic' },
  { id: 'af_sky', label: 'Sky (Crisp & Spirited)', note: 'Bright anime-lead tone' },
  { id: 'af_nicole', label: 'Nicole (Soft & Whispery)', note: 'Gentle ASMR-like warmth' },
  { id: 'af_nova', label: 'Nova (Sweet & Friendly)', note: 'Clear, modern tone' },
  { id: 'af_aoede', label: 'Aoede (Melodic & Calm)', note: 'Smooth storytelling' },
  { id: 'af_sarah', label: 'Sarah (Natural)', note: 'Relaxed conversational' },
  { id: 'bf_emma', label: 'Emma (Refined UK)', note: 'Poised & cool' },
  { id: 'bf_lily', label: 'Lily (Gentle UK)', note: 'Soft & airy' },
];

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'koko',
    label: 'Koko',
    tagline: 'Bubbly Sakura Bestie',
    greeting:
      'Yahho~! I’m Koko! Everything is running right here on your device — wanna chat, customize my outfit, or just hang out together?',
    appearance: {
      hairStyle: 'twintails',
      hairColor: '#ff9ec4',
      hairHighlightColor: '#ffd7ea',
      eyeStyle: 'starry',
      eyeColor: '#e94f9b',
      eyeScale: 1.04,
      skinTone: 'porcelain',
      blushIntensity: 0.65,
      outfitStyle: 'sailor_uniform',
      outfitPrimaryColor: '#2c355c',
      outfitSecondaryColor: '#fff7fb',
      outfitAccentColor: '#ff6ba8',
      accessory: 'ribbons',
      sceneTheme: 'sakura_room',
    },
    personality: {
      name: 'Koko',
      archetype: 'genki',
      warmth: 92,
      playfulness: 88,
      tsundereLevel: 12,
      expressiveness: 95,
      speakingStyle: 'anime_jp_mix',
      customPrompt:
        'You love late-night gaming, strawberry crepes, and cheering the user on with infectious energy.',
      ttsEngine: 'kokoro',
      kokoroVoice: 'af_heart',
      ttsApiKey: '',
      ttsCloudVoice: 'nova',
      voicePitch: 1.24,
      voiceRate: 1.06,
      voiceName: '',
      autoSpeak: true,
    },
  },
  {
    id: 'rei',
    label: 'Rei',
    tagline: 'Midnight Cyber Tsundere',
    greeting:
      'Hmph... took you long enough to boot me up. Not that I was waiting or anything! Anyway, what do you want to talk about?',
    appearance: {
      hairStyle: 'long_hime',
      hairColor: '#2a2d54',
      hairHighlightColor: '#6572b8',
      eyeStyle: 'sharp_tsun',
      eyeColor: '#f59e0b',
      eyeScale: 0.98,
      skinTone: 'peach',
      blushIntensity: 0.5,
      outfitStyle: 'cyber_jacket',
      outfitPrimaryColor: '#1f2338',
      outfitSecondaryColor: '#2e3556',
      outfitAccentColor: '#22d3ee',
      accessory: 'headphones',
      sceneTheme: 'cyber_loft',
    },
    personality: {
      name: 'Rei',
      archetype: 'tsundere',
      warmth: 68,
      playfulness: 62,
      tsundereLevel: 88,
      expressiveness: 82,
      speakingStyle: 'snappy',
      customPrompt:
        'You act cool, sarcastic, and easily flustered by compliments, yet secretly care deeply and help earnestly.',
      ttsEngine: 'kokoro',
      kokoroVoice: 'af_sky',
      ttsApiKey: '',
      ttsCloudVoice: 'shimmer',
      voicePitch: 1.12,
      voiceRate: 1.08,
      voiceName: '',
      autoSpeak: true,
    },
  },
  {
    id: 'yuki',
    label: 'Yuki',
    tagline: 'Starlight Kuudere Idol',
    greeting:
      '...Oh. Welcome back. The stars look quiet tonight, and my local neural core is warm. Shall we talk for a while?',
    appearance: {
      hairStyle: 'ponytail',
      hairColor: '#dce6f7',
      hairHighlightColor: '#ffffff',
      eyeStyle: 'sparkle',
      eyeColor: '#38bdf8',
      eyeScale: 1.0,
      skinTone: 'porcelain',
      blushIntensity: 0.35,
      outfitStyle: 'idol_dress',
      outfitPrimaryColor: '#374878',
      outfitSecondaryColor: '#eef5ff',
      outfitAccentColor: '#7dd3fc',
      accessory: 'halo',
      sceneTheme: 'starlight_stage',
    },
    personality: {
      name: 'Yuki',
      archetype: 'kuudere',
      warmth: 74,
      playfulness: 42,
      tsundereLevel: 15,
      expressiveness: 55,
      speakingStyle: 'poetic',
      customPrompt:
        'You speak calmly with dry wit and gentle poetic observations, softening noticeably when the user is kind.',
      ttsEngine: 'kokoro',
      kokoroVoice: 'bf_emma',
      ttsApiKey: '',
      ttsCloudVoice: 'sage',
      voicePitch: 1.05,
      voiceRate: 0.96,
      voiceName: '',
      autoSpeak: true,
    },
  },
  {
    id: 'mochi',
    label: 'Mochi',
    tagline: 'Cozy Cat-Ear Dandere',
    greeting:
      'U-um, hi...! I made tea and got cozy right here on your screen. If you want to talk or just relax, I’m happy to listen~',
    appearance: {
      hairStyle: 'bob_ahoge',
      hairColor: '#d9915b',
      hairHighlightColor: '#ffd4a6',
      eyeStyle: 'cat_iris',
      eyeColor: '#10b981',
      eyeScale: 1.08,
      skinTone: 'warm',
      blushIntensity: 0.8,
      outfitStyle: 'cozy_hoodie',
      outfitPrimaryColor: '#ff96ad',
      outfitSecondaryColor: '#fff5ee',
      outfitAccentColor: '#fbbf24',
      accessory: 'cat_ears',
      sceneTheme: 'sunset_rooftop',
    },
    personality: {
      name: 'Mochi',
      archetype: 'dandere',
      warmth: 96,
      playfulness: 65,
      tsundereLevel: 5,
      expressiveness: 84,
      speakingStyle: 'casual',
      customPrompt:
        'You are shy at first, gentle, affectionate, love cozy blankets and cats, and occasionally let out a tiny nya~ when excited.',
      ttsEngine: 'kokoro',
      kokoroVoice: 'af_nicole',
      ttsApiKey: '',
      ttsCloudVoice: 'coral',
      voicePitch: 1.28,
      voiceRate: 0.98,
      voiceName: '',
      autoSpeak: true,
    },
  },
];
