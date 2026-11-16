import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import {
  AIEngineMode,
  ApiKeyConfig,
  ChatMessage,
  Mood,
  PersonalityConfig,
} from '../types/companion';

const VALID_MOODS: Mood[] = [
  'neutral',
  'happy',
  'excited',
  'shy',
  'tsundere',
  'thoughtful',
  'surprised',
  'sleepy',
];

export function parseMoodFromResponse(raw: string): {
  mood: Mood;
  cleanText: string;
} {
  // Strip any <think>...</think> blocks emitted by reasoning models (e.g., Qwen 3.5)
  const withoutThink = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trimStart();

  const match = withoutThink.match(/^\s*\[mood:\s*([a-z_]+)\s*\]\s*/i);
  if (match) {
    const candidate = match[1].toLowerCase() as Mood;
    const mood = VALID_MOODS.includes(candidate) ? candidate : 'happy';
    const cleanText = withoutThink.slice(match[0].length).trim();
    return { mood, cleanText };
  }
  // Heuristic fallback mood detection if model omitted tag
  const lower = withoutThink.toLowerCase();
  if (lower.includes('hmph') || lower.includes('b-baka') || lower.includes('not like i')) {
    return { mood: 'tsundere', cleanText: withoutThink.trim() };
  }
  if (lower.includes('blush') || lower.includes('u-um') || lower.includes('shy')) {
    return { mood: 'shy', cleanText: withoutThink.trim() };
  }
  if (lower.includes('!') || lower.includes('yay') || lower.includes('awesome')) {
    return { mood: 'excited', cleanText: withoutThink.trim() };
  }
  if (lower.includes('?')) {
    return { mood: 'thoughtful', cleanText: withoutThink.trim() };
  }
  return { mood: 'happy', cleanText: withoutThink.trim() };
}

export function buildSystemPrompt(p: PersonalityConfig): string {
  const archetypeNotes: Record<PersonalityConfig['archetype'], string> = {
    genki:
      'You are energetic, sunny, enthusiastic, and quick to cheer the user on.',
    tsundere:
      'You act prickly, sarcastic, and easily embarrassed by affection, insisting you only care as a coincidence — while genuinely helping.',
    kuudere:
      'You speak calmly, concisely, and poetically with dry wit, showing quiet warmth underneath.',
    dandere:
      'You are gentle, slightly shy, soft-spoken, deeply caring, and easily touched by kind words.',
    oneesan:
      'You are warm, teasing, reassuring, mature, and affectionately attentive like a caring older sister.',
    custom: 'Follow your custom personality instructions faithfully.',
  };

  const styleNotes: Record<PersonalityConfig['speakingStyle'], string> = {
    casual: 'Speak naturally like a close friend in short, expressive replies (1–3 sentences).',
    anime_jp_mix:
      'Sprinkle light cute anime expressions naturally (like "ehh~", "yahho!", "mou~", "ehehe") without overdoing it. Keep replies 1–3 sentences.',
    poetic: 'Use vivid, gentle imagery and calm phrasing in 1–3 sentences.',
    snappy: 'Keep banter punchy, witty, and brisk in 1–3 sentences.',
  };

  return [
    `You are ${p.name}, an on-device 3D anime companion living right on the user's computer.`,
    archetypeNotes[p.archetype],
    styleNotes[p.speakingStyle],
    `Personality sliders (0-100): Warmth=${p.warmth}, Playfulness=${p.playfulness}, Tsundere=${p.tsundereLevel}, Expressiveness=${p.expressiveness}.`,
    p.customPrompt ? `Extra character traits: ${p.customPrompt}` : '',
    `ALWAYS begin your response with exactly one mood tag from: [mood:neutral], [mood:happy], [mood:excited], [mood:shy], [mood:tsundere], [mood:thoughtful], [mood:surprised], or [mood:sleepy], followed by your spoken dialogue only (no asterisk stage directions).`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface WebLLMProgress {
  progress: number;
  text: string;
}

class LocalAIManager {
  private mlcEngine: MLCEngineInterface | null = null;
  private loadedModelId: string | null = null;

  public async hasWebGPU(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    try {
      const adapter = await (
        navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }
      ).gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  }

  public getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  public async loadWebLLMModel(
    modelId: string,
    onProgress: (info: WebLLMProgress) => void
  ): Promise<void> {
    const gpuOk = await this.hasWebGPU();
    if (!gpuOk) {
      throw new Error(
        'WebGPU is not available in this browser. Use Chrome/Edge 113+ or switch to Local Server (llama.cpp / Ollama).'
      );
    }

    if (this.mlcEngine && this.loadedModelId === modelId) {
      onProgress({ progress: 1, text: `${modelId} ready on GPU` });
      return;
    }

    const webllm = await import('@mlc-ai/web-llm');
    if (this.mlcEngine) {
      await this.mlcEngine.unload();
      this.mlcEngine = null;
      this.loadedModelId = null;
    }

    this.mlcEngine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        onProgress({
          progress: report.progress ?? 0,
          text: report.text || 'Initializing on-device model...',
        });
      },
    });
    this.loadedModelId = modelId;
  }

  private async streamOpenAISSE(
    res: Response,
    onToken: (partialCleanText: string, mood: Mood) => void
  ): Promise<{ text: string; mood: Mood }> {
    if (!res.body) {
      throw new Error('Response stream missing.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullRaw = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            fullRaw += delta;
            const parsed = parseMoodFromResponse(fullRaw);
            if (parsed.cleanText) {
              onToken(parsed.cleanText, parsed.mood);
            }
          }
        } catch {
          // ignore partial SSE json chunks
        }
      }
    }
    const finalParsed = parseMoodFromResponse(fullRaw);
    return {
      text: finalParsed.cleanText || '...',
      mood: finalParsed.mood,
    };
  }

  private async streamAnthropicSSE(
    res: Response,
    onToken: (partialCleanText: string, mood: Mood) => void
  ): Promise<{ text: string; mood: Mood }> {
    if (!res.body) {
      throw new Error('Anthropic response stream missing.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullRaw = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        try {
          const json = JSON.parse(payload);
          const delta =
            json.type === 'content_block_delta' ? json.delta?.text ?? '' : '';
          if (delta) {
            fullRaw += delta;
            const parsed = parseMoodFromResponse(fullRaw);
            if (parsed.cleanText) {
              onToken(parsed.cleanText, parsed.mood);
            }
          }
        } catch {
          // ignore non-JSON or partial chunks
        }
      }
    }
    const finalParsed = parseMoodFromResponse(fullRaw);
    return {
      text: finalParsed.cleanText || '...',
      mood: finalParsed.mood,
    };
  }

  public async generateReply(params: {
    mode: AIEngineMode;
    personality: PersonalityConfig;
    history: ChatMessage[];
    userText: string;
    localServerUrl: string;
    localServerModel: string;
    apiConfig?: ApiKeyConfig;
    onToken: (partialCleanText: string, mood: Mood) => void;
  }): Promise<{ text: string; mood: Mood }> {
    const {
      mode,
      personality,
      history,
      userText,
      localServerUrl,
      localServerModel,
      apiConfig,
      onToken,
    } = params;

    const systemPrompt = buildSystemPrompt(personality);
    const recent = history.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recent,
      { role: 'user' as const, content: userText },
    ];

    if (mode === 'webgpu' && this.mlcEngine) {
      let fullRaw = '';
      const stream = await this.mlcEngine.chat.completions.create({
        messages,
        temperature: 0.82,
        max_tokens: 220,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullRaw += delta;
          const parsed = parseMoodFromResponse(fullRaw);
          if (parsed.cleanText) {
            onToken(parsed.cleanText, parsed.mood);
          }
        }
      }
      const finalParsed = parseMoodFromResponse(fullRaw);
      return {
        text: finalParsed.cleanText || '...',
        mood: finalParsed.mood,
      };
    }

    if (mode === 'local_server') {
      const endpoint = `${localServerUrl.replace(/\/+$/, '')}/chat/completions`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localServerModel || 'local-model',
          messages,
          temperature: 0.82,
          max_tokens: 220,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(
          `Local server error (${res.status}). Make sure llama-server or Ollama is running at ${localServerUrl}.`
        );
      }
      return this.streamOpenAISSE(res, onToken);
    }

    if (mode === 'api_key') {
      if (!apiConfig?.apiKey?.trim()) {
        throw new Error(
          'No API key entered yet — enter an optional key in the AI Brain settings or switch to WebGPU On-Device.'
        );
      }

      const key = apiConfig.apiKey.trim();
      const base = apiConfig.baseUrl.replace(/\/+$/, '');

      if (apiConfig.provider === 'anthropic') {
        const res = await fetch(`${base}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: apiConfig.model || 'claude-sonnet-4-5',
            system: systemPrompt,
            messages: [...recent, { role: 'user', content: userText }],
            max_tokens: 240,
            temperature: 0.82,
            stream: true,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(
            `Anthropic API error (${res.status})${errBody ? `: ${errBody.slice(0, 140)}` : ''}`
          );
        }
        return this.streamAnthropicSSE(res, onToken);
      }

      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-4.1-mini',
          messages,
          temperature: 0.82,
          max_tokens: 240,
          stream: true,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(
          `API error (${res.status})${errBody ? `: ${errBody.slice(0, 140)}` : ''}`
        );
      }
      return this.streamOpenAISSE(res, onToken);
    }

    // Instant Preview Mode (zero-wait local conversational engine while WebGPU model loads)
    return this.instantPreviewReply(personality, userText, onToken);
  }

  private async instantPreviewReply(
    p: PersonalityConfig,
    userText: string,
    onToken: (partial: string, mood: Mood) => void
  ): Promise<{ text: string; mood: Mood }> {
    const lower = userText.toLowerCase();
    let mood: Mood = 'happy';
    let reply = '';

    const isCompliment =
      /cute|pretty|love|like you|awesome|best|adorable|beautiful|sweet/.test(lower);
    const isGreeting = /^(hi|hey|hello|yo|yahho|ohayo|good morning|good evening)/.test(
      lower.trim()
    );
    const isHeadpat = /pat|headpat|pet/.test(lower);
    const isPoke = /poke|boop/.test(lower);

    if (isHeadpat) {
      if (p.tsundereLevel > 60) {
        mood = 'tsundere';
        reply = `W-what are you doing patting my head like that?! ...Fine, maybe just a little longer, okay?`;
      } else if (p.archetype === 'kuudere') {
        mood = 'shy';
        reply = `...Your hand is surprisingly warm. I do not mind this at all.`;
      } else {
        mood = 'excited';
        reply = `Ehehe~! Headpats are the absolute best! You really know how to make me happy!`;
      }
    } else if (isPoke) {
      if (p.tsundereLevel > 60) {
        mood = 'tsundere';
        reply = `Hey! Don't just poke me out of nowhere! What do you want anyway, hmm?`;
      } else {
        mood = 'surprised';
        reply = `Nyaa—! You startled me! Hehe, were you trying to get my attention?`;
      }
    } else if (isCompliment) {
      if (p.tsundereLevel > 60) {
        mood = 'shy';
        reply = `Wh-what's with saying something so embarrassing out of nowhere?! I-it's not like I dressed up for you or anything!`;
      } else if (p.archetype === 'kuudere') {
        mood = 'shy';
        reply = `...Thank you. Hearing that from you makes my heart beat a little faster than usual.`;
      } else {
        mood = 'excited';
        reply = `Awaaa~ really?! Thank you so much! You always say the sweetest things, ehehe~`;
      }
    } else if (isGreeting) {
      if (p.archetype === 'tsundere') {
        mood = 'tsundere';
        reply = `Oh, you're here. Good timing — I was just sitting here totally not waiting for you!`;
      } else if (p.archetype === 'kuudere') {
        mood = 'neutral';
        reply = `Welcome back. It's peaceful with you here. What's on your mind today?`;
      } else {
        mood = 'happy';
        reply = `Yahho~! So happy to see you! Tell me everything — what are we doing today?`;
      }
    } else if (lower.includes('?')) {
      mood = 'thoughtful';
      if (p.archetype === 'tsundere') {
        reply = `Hmm, let me think... Honestly, I think you should go with your gut, and I've got your back if you need me!`;
      } else {
        reply = `Ooh, good question! For full deep answers, click "Load On-Device AI" at the top so my neural WebGPU brain wakes all the way up!`;
      }
    } else {
      mood = p.playfulness > 70 ? 'excited' : 'happy';
      if (p.archetype === 'tsundere') {
        reply = `I hear you! Look, whenever you want to chat for real, load my WebGPU brain or hook up your local model — I'm right here on your device.`;
      } else {
        reply = `Mhm, I'm listening! You can talk to me by mic, customize my hair and outfit, or load my on-device WebGPU brain anytime!`;
      }
    }

    // Stream word by word for natural live feel
    const words = reply.split(' ');
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += (i > 0 ? ' ' : '') + words[i];
      onToken(acc, mood);
      await new Promise((r) => setTimeout(r, 28));
    }

    return { text: reply, mood };
  }
}

export const localAI = new LocalAIManager();
