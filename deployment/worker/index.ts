import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  AgentError,
  health,
  runAgent,
  type RuntimeEnv,
} from "../lib/agent";

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env extends RuntimeEnv {
  ASSETS: AssetFetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: JSON_HEADERS,
  });
}

function streamEvent(event: string, payload: Record<string, unknown> = {}): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify({ event, ...payload })}\n`);
}

async function parsePayload(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 8_000_000) throw new AgentError("Payload quá lớn.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentError("JSON không hợp lệ.");
  }
  return value as Record<string, unknown>;
}

async function handleAgent(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await parsePayload(request);
    return jsonResponse(await runAgent(payload, env, request.signal));
  } catch (error) {
    if (error instanceof AgentError) return jsonResponse({ error: error.message }, 422);
    return jsonResponse({ error: "Agent gặp lỗi nội bộ." }, 500);
  }
}

function handleAgentStream(request: Request, env: Env): Response {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(streamEvent("start"));
      try {
        const payload = await parsePayload(request);
        const answer = await runAgent(payload, env, request.signal);
        controller.enqueue(streamEvent("result", { data: answer }));
      } catch (error) {
        if (!request.signal.aborted) {
          controller.enqueue(
            streamEvent("error", {
              error:
                error instanceof AgentError
                  ? error.message
                  : "Agent gặp lỗi nội bộ.",
            }),
          );
        }
      } finally {
        try {
          controller.close();
        } catch {
          // The browser may have cancelled the stream.
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse(health(env));
    }
    if (url.pathname === "/api/agent" && request.method === "POST") {
      return handleAgent(request, env);
    }
    if (url.pathname === "/api/agent/stream" && request.method === "POST") {
      return handleAgentStream(request, env);
    }
    if (url.pathname === "/codebase" || url.pathname === "/codebase/") {
      return env.ASSETS.fetch(new Request(new URL("/codebase/index.html", request.url), request));
    }
    if (
      url.pathname.startsWith("/codebase/") ||
      url.pathname.startsWith("/data/") ||
      url.pathname.startsWith("/logo/") ||
      url.pathname === "/og.png"
    ) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
