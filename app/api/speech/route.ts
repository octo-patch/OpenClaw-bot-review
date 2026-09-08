import { NextResponse } from "next/server";
import {
  MINIMAX_TTS_MODELS,
  MiniMaxTtsAudioFormat,
  MiniMaxTtsError,
  MiniMaxTtsModel,
  MiniMaxTtsRegion,
  synthesizeMiniMaxSpeech,
} from "@/lib/minimax-tts";

const AUDIO_CONTENT_TYPES: Record<MiniMaxTtsAudioFormat, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  pcm: "audio/L16",
};

export async function POST(request: Request) {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server speech synthesis is not configured", fallback: "browser" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      text?: unknown;
      model?: unknown;
      region?: unknown;
      format?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const model = typeof body.model === "string" ? body.model : MINIMAX_TTS_MODELS[0];
    const region = body.region === "cn" ? "cn" : "global";
    const format = typeof body.format === "string" ? body.format : "mp3";

    const result = await synthesizeMiniMaxSpeech({
      apiKey,
      region: region as MiniMaxTtsRegion,
      request: {
        model: model as MiniMaxTtsModel,
        text,
        output_format: "hex",
        audio_setting: { format: format as MiniMaxTtsAudioFormat },
      },
    });

    return new Response(Buffer.from(result.audio), {
      headers: {
        "Content-Type": AUDIO_CONTENT_TYPES[result.format],
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof MiniMaxTtsError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Speech synthesis failed";
    return NextResponse.json({ error: message, fallback: "browser" }, { status });
  }
}
