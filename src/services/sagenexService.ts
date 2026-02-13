/**
 * Sagenex SGX Loyalty Reward integration.
 *
 * Endpoints (on Sagenex backend):
 *   POST /sggold/verify   — verify an eligibility code
 *   GET  /sggold/status    — check code status (admin/debug)
 *
 * Auth: x-sggold-api-key header
 */

import { env } from "../config/env.js";

export type SgxVerifyResult = {
  valid: boolean;
  code: string;
  sagenexUserId?: string;
  reward?: string;
  redeemedAt?: string;
  error?: string;
};

export type SgxStatusResult = {
  code: string;
  status: "active" | "redeemed" | "expired";
  generatedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  sagenexUserId: string;
  sggoldUserId: string | null;
  reward: string;
};

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (env.SAGENEX_API_KEY) {
    headers["x-sggold-api-key"] = env.SAGENEX_API_KEY;
  }
  return headers;
}

/**
 * Verify an SGX eligibility code.
 * Called during scheme enrollment when user enters a code.
 */
export async function verifySgxCode(params: {
  code: string;
  sggoldUserId: string;
  sggoldSchemeId?: string;
  monthlyAmountPaise: number;
}): Promise<SgxVerifyResult> {
  if (!env.SAGENEX_API_KEY) {
    throw new Error("Sagenex integration not configured (SAGENEX_API_KEY missing)");
  }

  const res = await fetch(`${env.SAGENEX_API_URL}/sggold/verify`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json()) as SgxVerifyResult;

  if (!res.ok) {
    return {
      valid: false,
      code: params.code,
      error: data.error ?? `Verification failed (${res.status})`,
    };
  }

  return data;
}

/**
 * Check code status (for admin use).
 */
export async function getSgxCodeStatus(code: string): Promise<SgxStatusResult | null> {
  if (!env.SAGENEX_API_KEY) return null;

  try {
    const res = await fetch(
      `${env.SAGENEX_API_URL}/sggold/status?code=${encodeURIComponent(code)}`,
      {
        headers: getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;
    return (await res.json()) as SgxStatusResult;
  } catch {
    return null;
  }
}
