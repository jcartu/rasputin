import { describe, it, expect } from "vitest";

describe("ElevenLabs API Key Validation", () => {
  it("should have ELEVENLABS_API_KEY environment variable set", () => {
    expect(process.env.ELEVENLABS_API_KEY).toBeDefined();
    expect(process.env.ELEVENLABS_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should successfully authenticate with ElevenLabs API", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeDefined();

    // Test API key by fetching available voices (lightweight endpoint)
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey!,
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.voices).toBeDefined();
    expect(Array.isArray(data.voices)).toBe(true);
    expect(data.voices.length).toBeGreaterThan(0);

    // Log available voices for reference
    console.log(
      "Available ElevenLabs voices:",
      data.voices.slice(0, 5).map((v: any) => ({
        name: v.name,
        voice_id: v.voice_id,
      }))
    );
  });
});
