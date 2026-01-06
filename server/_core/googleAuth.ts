import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import crypto from "crypto";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Store state tokens temporarily (in production, use Redis or database)
const stateTokens = new Map<
  string,
  { redirectUri: string; createdAt: number }
>();

// Clean up old state tokens every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    const entries = Array.from(stateTokens.entries());
    for (const [token, data] of entries) {
      if (now - data.createdAt > 10 * 60 * 1000) {
        // 10 minutes expiry
        stateTokens.delete(token);
      }
    }
  },
  5 * 60 * 1000
);

function getBaseUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${protocol}://${host}`;
}

export function registerGoogleAuthRoutes(app: Express) {
  // Check if Google OAuth is configured
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn(
      "[Google Auth] Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing"
    );
    return;
  }

  console.log("[Google Auth] Registering Google OAuth routes");

  // Initiate Google OAuth flow
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Generate a secure state token
    const state = crypto.randomBytes(32).toString("hex");
    stateTokens.set(state, { redirectUri, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: state,
      access_type: "offline",
      prompt: "select_account",
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    console.log("[Google Auth] Redirecting to Google OAuth:", authUrl);
    res.redirect(authUrl);
  });

  // Handle Google OAuth callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      console.error("[Google Auth] OAuth error:", error);
      res.redirect("/login?error=oauth_denied");
      return;
    }

    if (!code || !state) {
      console.error("[Google Auth] Missing code or state");
      res.redirect("/login?error=invalid_request");
      return;
    }

    // Verify state token
    const stateData = stateTokens.get(state);
    if (!stateData) {
      console.error("[Google Auth] Invalid or expired state token");
      res.redirect("/login?error=invalid_state");
      return;
    }
    stateTokens.delete(state);

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: stateData.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[Google Auth] Token exchange failed:", errorText);
        res.redirect("/login?error=token_exchange_failed");
        return;
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        id_token?: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get user info from Google
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error("[Google Auth] Failed to get user info");
        res.redirect("/login?error=userinfo_failed");
        return;
      }

      const googleUser = (await userInfoResponse.json()) as {
        id: string;
        email: string;
        name: string;
        picture?: string;
        verified_email?: boolean;
      };

      console.log("[Google Auth] User authenticated:", googleUser.email);

      // Create a unique openId for Google users
      const openId = `google_${googleUser.id}`;

      // Upsert user in database
      await db.upsertUser({
        openId: openId,
        name: googleUser.name || null,
        email: googleUser.email ?? null,
        avatarUrl: googleUser.picture || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log("[Google Auth] Session created for:", googleUser.email);
      res.redirect("/chat");
    } catch (error) {
      console.error("[Google Auth] Callback error:", error);
      res.redirect("/login?error=auth_failed");
    }
  });
}
