import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const user = await db.getUserByUsername(username);

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || username,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });

    console.log(`[Auth] User logged in: ${username}`);
    res.json({ success: true, redirect: "/agent" });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const sessionToken = req.cookies[COOKIE_NAME];
    if (!sessionToken) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const session = await sdk.verifySession(sessionToken);
      if (!session) {
        res.status(401).json({ error: "Invalid session" });
        return;
      }
      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch {
      res.status(401).json({ error: "Invalid session" });
    }
  });
}

export async function ensureDefaultUser() {
  const existingUser = await db.getUserByUsername("josh");
  if (existingUser) {
    console.log("[Auth] Default user 'josh' already exists");
    return;
  }

  const passwordHash = hashPassword("Thermite1950!$");

  await db.createUserWithPassword({
    openId: "josh_local",
    username: "josh",
    passwordHash,
    name: "Josh",
    email: "josh@rasputin.studio",
    role: "admin",
  });

  console.log("[Auth] Created default user 'josh'");
}

export async function ensureSilvsUser() {
  const existingUser = await db.getUserByUsername("silvs");
  if (existingUser) {
    console.log("[Auth] User 'silvs' already exists");
    return;
  }

  const passwordHash = hashPassword("fhp394fhq3p");

  await db.createUserWithPassword({
    openId: "silvs_local",
    username: "silvs",
    passwordHash,
    name: "Silvs",
    email: "silvs@rasputin.studio",
    role: "user",
  });

  console.log("[Auth] Created user 'silvs'");
}

export async function ensureDirkUser() {
  const existingUser = await db.getUserByUsername("dirk");
  if (existingUser) {
    console.log("[Auth] User 'dirk' already exists");
    return;
  }

  const passwordHash = hashPassword("fhp394fhq38");

  await db.createUserWithPassword({
    openId: "dirk_local",
    username: "dirk",
    passwordHash,
    name: "Dirk",
    email: "dirk@rasputin.studio",
    role: "user",
  });

  console.log("[Auth] Created user 'dirk'");
}

export async function ensureAlakazamUser() {
  const existingUser = await db.getUserByUsername("alakazam");
  if (existingUser) {
    console.log("[Auth] User 'alakazam' already exists");
    return;
  }

  const passwordHash = hashPassword("3dfh9723fd");

  await db.createUserWithPassword({
    openId: "alakazam_local",
    username: "alakazam",
    passwordHash,
    name: "Alakazam",
    email: "alakazam@rasputin.studio",
    role: "user",
  });

  console.log("[Auth] Created user 'alakazam'");
}
