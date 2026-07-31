import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const runtimeKeys = [
    "AI_API_KEY",
    "DEEPSEEK_API_KEY",
    "AI_BASE_URL",
    "AI_MODEL",
    "VISION_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "VISION_BASE_URL",
    "VISION_MODEL",
  ] as const;
  const localRuntimeVars =
    command === "serve"
      ? Object.fromEntries(
          runtimeKeys.flatMap((key) =>
            process.env[key] ? [[key, process.env[key]]] : [],
          ),
        )
      : {};

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          vars: localRuntimeVars,
        },
      }),
    ],
  };
});
