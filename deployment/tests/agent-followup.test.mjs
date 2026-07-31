import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let runAgent;

before(async () => {
  server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ runAgent } = await server.ssrLoadModule("/lib/agent.ts"));
});

after(async () => {
  await server.close();
});

test("summary count follow-up keeps full-document scope instead of the current slide", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: "test-request",
      model: "test-model",
      choices: [{
        message: {
          content: JSON.stringify({
            intent: "summary",
            scope: "course",
            conf: 90,
            kind: "answered",
            body: Array.from({ length: 10 }, (_, index) => `Ý ${index + 1} [trang 1]`),
            sources: [],
          }),
        },
      }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const answer = await runAgent({
      question: "Make it 10 points",
      document: "d2-slide-hackathon.pdf",
      page: 4,
      history: [
        {
          role: "user",
          content: "Summarize the deck into 5 bullet points",
          document: "d2-slide-hackathon.pdf",
          page: 4,
          intent: "summary",
        },
        {
          role: "assistant",
          content: "Previous five-point summary",
          document: "d2-slide-hackathon.pdf",
          page: 4,
          intent: "summary",
        },
      ],
    }, {
      AI_API_KEY: "test-key",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "test-model",
    }, new AbortController().signal);

    const currentPrompt = requestBody.messages.at(-1).content;
    assert.match(currentPrompt, /"reference_page":null/);
    assert.match(currentPrompt, /"summary_scope":"full_document"/);
    assert.match(currentPrompt, /"revision_of_previous_summary":true/);
    assert.doesNotMatch(requestBody.messages[1].content, /trang 4/);
    assert.doesNotMatch(requestBody.messages[2].content, /trang 4/);
    assert.equal(answer.body.length, 10);
    assert.equal(answer.context.page, null);
    assert.equal(answer.context.reference_kind, "full_document");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
