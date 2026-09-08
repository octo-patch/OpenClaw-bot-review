export const MINIMAX_TTS_ENDPOINTS = {
  global: "https://api.minimax.io/v1/t2a_v2",
  cn: "https://api.minimaxi.com/v1/t2a_v2",
} as const;

export const MINIMAX_TTS_MODELS = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
  "speech-01-hd",
  "speech-01-turbo",
] as const;

export const MINIMAX_TTS_AUDIO_FORMATS = ["mp3", "wav", "flac", "pcm"] as const;

export type MiniMaxTtsRegion = keyof typeof MINIMAX_TTS_ENDPOINTS;
export type MiniMaxTtsModel = (typeof MINIMAX_TTS_MODELS)[number];
export type MiniMaxTtsAudioFormat = (typeof MINIMAX_TTS_AUDIO_FORMATS)[number];

export interface MiniMaxTtsRequest {
  model: MiniMaxTtsModel;
  text: string;
  stream?: boolean;
  language_boost?: string;
  output_format?: string;
  voice_setting?: Record<string, unknown>;
  pronunciation_dict?: Record<string, unknown>;
  audio_setting?: {
    format?: MiniMaxTtsAudioFormat;
    [key: string]: unknown;
  };
  voice_modify?: Record<string, unknown>;
  subtitle_enable?: boolean;
}

interface MiniMaxTtsResponse {
  data?: {
    audio?: string;
    status?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export class MiniMaxTtsError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "MiniMaxTtsError";
  }
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.includes(value as T);
}

function decodeAudio(value: string): Uint8Array {
  const normalized = value.trim();
  if (!normalized) {
    throw new MiniMaxTtsError("The speech service returned empty audio data");
  }

  if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(normalized, "hex"));
  }

  try {
    const audio = Uint8Array.from(Buffer.from(normalized, "base64"));
    if (audio.length === 0) {
      throw new Error("empty buffer");
    }
    return audio;
  } catch {
    throw new MiniMaxTtsError("The speech service returned invalid audio data");
  }
}

function validateRequest(request: MiniMaxTtsRequest): void {
  if (!isOneOf(MINIMAX_TTS_MODELS, request.model)) {
    throw new MiniMaxTtsError("Unsupported speech model", 400);
  }
  if (!request.text.trim()) {
    throw new MiniMaxTtsError("Text is required", 400);
  }
  const format = request.audio_setting?.format;
  if (format && !isOneOf(MINIMAX_TTS_AUDIO_FORMATS, format)) {
    throw new MiniMaxTtsError("Unsupported audio format", 400);
  }
}

export async function synthesizeMiniMaxSpeech(options: {
  apiKey: string;
  region: MiniMaxTtsRegion;
  request: MiniMaxTtsRequest;
  fetchImpl?: typeof fetch;
}): Promise<{ audio: Uint8Array; format: MiniMaxTtsAudioFormat }> {
  const { apiKey, region, request, fetchImpl = fetch } = options;
  validateRequest(request);

  const response = await fetchImpl(MINIMAX_TTS_ENDPOINTS[region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  let body: MiniMaxTtsResponse;
  try {
    body = (await response.json()) as MiniMaxTtsResponse;
  } catch {
    throw new MiniMaxTtsError("The speech service returned an invalid response", response.status || 502);
  }

  const serviceCode = body.base_resp?.status_code;
  if (!response.ok || (serviceCode !== undefined && serviceCode !== 0)) {
    throw new MiniMaxTtsError(
      body.base_resp?.status_msg || `Speech synthesis failed with status ${response.status}`,
      response.ok ? 502 : response.status,
    );
  }
  if (body.data?.status !== undefined && body.data.status !== 2) {
    throw new MiniMaxTtsError(`Speech synthesis did not complete (status ${body.data.status})`);
  }

  return {
    audio: decodeAudio(body.data?.audio || ""),
    format: request.audio_setting?.format || "mp3",
  };
}
