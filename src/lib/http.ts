import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ApiResult } from "./types";

export function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return Response.json(body, { status, headers });
}

export function errorResponse(status: number, message: string, headers?: Record<string, string>): Response {
  return json(status, { error: message }, headers);
}

export function toResponse<T>(result: ApiResult<T>): Response {
  return json(result.status, result.body, result.headers);
}

function sha256(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

/** Level 2: constant-time comparison of X-API-Key against the API_KEY env var. */
function checkApiKey(request: Request): Response | null {
  const expected = process.env.API_KEY;
  if (!expected) {
    console.error("API_KEY is not configured; rejecting all API requests");
    return errorResponse(500, "server is not configured");
  }
  const provided = request.headers.get("x-api-key");
  if (!provided || !timingSafeEqual(sha256(provided), sha256(expected))) {
    return errorResponse(401, "missing or invalid API key");
  }
  return null;
}

type Handler<C> = (request: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with API-key auth and a JSON 500 for unexpected errors. */
export function withApi<C>(handler: Handler<C>): Handler<C> {
  return async (request, ctx) => {
    const denied = checkApiKey(request);
    if (denied) return denied;
    try {
      return await handler(request, ctx);
    } catch (err) {
      console.error(err);
      return errorResponse(500, "internal server error");
    }
  };
}

/** Reads a JSON body; returns undefined-free discriminated result so callers can 400 cleanly. */
export async function readJson(request: Request): Promise<{ ok: true; raw: string; value: unknown } | { ok: false; raw: string }> {
  const raw = await request.text();
  try {
    return { ok: true, raw, value: JSON.parse(raw) };
  } catch {
    return { ok: false, raw };
  }
}
