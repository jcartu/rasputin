import { describe, it, expect } from "vitest";

describe("Google OAuth Credentials", () => {
  it("should have GOOGLE_CLIENT_ID environment variable set", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    // Google Client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("should have GOOGLE_CLIENT_SECRET environment variable set", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeDefined();
    expect(clientSecret).not.toBe("");
    // Google Client Secrets start with GOCSPX-
    expect(clientSecret).toMatch(/^GOCSPX-/);
  });

  it("should have valid Google OAuth client ID format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    // Format: {numbers}-{alphanumeric}.apps.googleusercontent.com
    const pattern = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
    expect(clientId).toMatch(pattern);
  });
});
