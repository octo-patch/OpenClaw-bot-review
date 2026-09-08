import { describe, expect, it, vi } from "vitest";
import {
  MINIMAX_TTS_AUDIO_FORMATS,
  MINIMAX_TTS_ENDPOINTS,
  MINIMAX_TTS_MODELS,
  synthesizeMiniMaxSpeech,
} from "../lib/minimax-tts";

describe("synthesizeMiniMaxSpeech", () => {
  it("supports current speech models, formats, and regional endpoints", () => {
    expect(MINIMAX_TTS_MODELS).toEqual([
      "speech-2.8-hd",
      "speech-2.8-turbo",
      "speech-2.6-hd",
      "speech-2.6-turbo",
      "speech-02-hd",
      "speech-02-turbo",
      "speech-01-hd",
      "speech-01-turbo",
    ]);
    expect(MINIMAX_TTS_AUDIO_FORMATS).toEqual(["mp3", "wav", "flac", "pcm"]);
    expect(MINIMAX_TTS_ENDPOINTS).toEqual({
      global: "https://api.minimax.io/v1/t2a_v2",
      cn: "https://api.minimaxi.com/v1/t2a_v2",
    });
  });

  it("sends required fields and parses hexadecimal audio", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { audio: "494433", status: 2 },
          base_resp: { status_code: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await synthesizeMiniMaxSpeech({
      apiKey: "test-key",
      region: "cn",
      request: {
        model: "speech-2.8-hd",
        text: "Daily report",
        output_format: "hex",
        audio_setting: { format: "mp3" },
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      MINIMAX_TTS_ENDPOINTS.cn,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "speech-2.8-hd",
          text: "Daily report",
          output_format: "hex",
          audio_setting: { format: "mp3" },
        }),
      }),
    );
    expect([...result.audio]).toEqual([0x49, 0x44, 0x33]);
  });

  it("rejects unsupported models before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      synthesizeMiniMaxSpeech({
        apiKey: "test-key",
        region: "global",
        request: { model: "unknown" as never, text: "Daily report" },
        fetchImpl,
      }),
    ).rejects.toThrow("Unsupported speech model");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports provider response errors", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ base_resp: { status_code: 1001, status_msg: "Invalid request" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      synthesizeMiniMaxSpeech({
        apiKey: "test-key",
        region: "global",
        request: { model: "speech-2.8-turbo", text: "Daily report" },
        fetchImpl,
      }),
    ).rejects.toThrow("Invalid request");
  });
});
