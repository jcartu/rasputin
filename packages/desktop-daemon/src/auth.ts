import { createHash, randomBytes } from "crypto";

export interface PairingInfo {
  userId: number;
  username: string;
  serverUrl: string;
  token: string;
  pairedAt: number;
}

let pairingInfo: PairingInfo | null = null;
let pairingCode: string | null = null;
let pairingExpiry: number | null = null;

const PAIRING_EXPIRY_MS = 5 * 60 * 1000;

export function generatePairingCode(): string {
  pairingCode = randomBytes(4).toString("hex").toUpperCase();
  pairingExpiry = Date.now() + PAIRING_EXPIRY_MS;
  return pairingCode;
}

export function validatePairingCode(code: string): boolean {
  if (!pairingCode || !pairingExpiry) return false;
  if (Date.now() > pairingExpiry) {
    pairingCode = null;
    pairingExpiry = null;
    return false;
  }
  return code.toUpperCase() === pairingCode;
}

export function completePairing(info: Omit<PairingInfo, "pairedAt">): void {
  pairingInfo = {
    ...info,
    pairedAt: Date.now(),
  };
  pairingCode = null;
  pairingExpiry = null;
}

export function getPairingInfo(): PairingInfo | null {
  return pairingInfo;
}

export function isPaired(): boolean {
  return pairingInfo !== null;
}

export function validateToken(token: string | null): boolean {
  if (!token || !pairingInfo) return false;
  return token === pairingInfo.token;
}

export function unpair(): void {
  pairingInfo = null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getPairingStatus(): {
  paired: boolean;
  user?: string;
  server?: string;
  awaitingPairing: boolean;
  pairingExpiresIn?: number;
} {
  if (pairingInfo) {
    return {
      paired: true,
      user: pairingInfo.username,
      server: pairingInfo.serverUrl,
      awaitingPairing: false,
    };
  }

  if (pairingCode && pairingExpiry) {
    return {
      paired: false,
      awaitingPairing: true,
      pairingExpiresIn: Math.max(0, pairingExpiry - Date.now()),
    };
  }

  return {
    paired: false,
    awaitingPairing: false,
  };
}
