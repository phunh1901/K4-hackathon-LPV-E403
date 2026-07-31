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

test("quiz mode accepts an empty typed question and returns grounded questions", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: "quiz-request",
      model: "test-model",
      choices: [{
        message: {
          content: JSON.stringify({
            note: "",
            questions: [{
              q: "Mục tiêu của Agenda Day 02 là gì?",
              options: [
                "Biến yêu cầu mơ hồ thành Problem Statement rõ ràng",
                "Chỉ học cách viết code",
                "Chỉ đánh giá mô hình",
                "Không cần ra quyết định",
              ],
              correct: 0,
              excerpt: "Biến yêu cầu mơ hồ thành Problem Statement rõ ràng để ra quyết định",
              why_wrong: [
                "Agenda bao gồm Problem Discovery.",
                "Nội dung rộng hơn đánh giá mô hình.",
                "Mục tiêu nêu rõ việc ra quyết định.",
              ],
            }],
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
      question: "",
      mode: "quiz",
      document: "d2-slide-hackathon.pdf",
      page: 2,
    }, {
      AI_API_KEY: "test-key",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "test-model",
    }, new AbortController().signal);

    assert.equal(answer.kind, "quiz");
    assert.equal(answer.page, 2);
    assert.equal(answer.questions.length, 1);
    assert.equal(answer.questions[0].correct, 0);
    assert.equal(answer.questions[0].origin, "slide");
    assert.match(answer.questions[0].excerpt, /Problem Statement/);
    assert.match(requestBody.messages[0].content, /ra đề trắc nghiệm/i);
    assert.match(requestBody.messages[1].content, /REQUEST CONTEXT/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quiz mode returns a useful note without calling the model for a thin page", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called for a thin page");
  };

  try {
    const answer = await runAgent({
      question: "",
      mode: "quiz",
      document: "d2-slide-hackathon.pdf",
      page: 1,
    }, {
      AI_API_KEY: "test-key",
    }, new AbortController().signal);

    assert.equal(fetchCalled, false);
    assert.equal(answer.kind, "quiz");
    assert.deepEqual(answer.questions, []);
    assert.match(answer.note, /không chụp được ảnh/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quiz mode uses detailed vision structure for the visual decision tree on Day 2 page 21", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    requests.push(request);
    const isVision = Array.isArray(request.messages[1].content);
    const content = isVision
      ? {
          description: "Cây quyết định lựa chọn Rule, Workflow hoặc Agent.",
          visible_text: "Bài toán có quy tắc rõ ràng? CÓ KHÔNG Rule Workflow Agent",
          elements: [
            { id: "n1", label: "Bài toán có quy tắc rõ ràng?", kind: "node", details: "Nút đầu" },
            { id: "n2", label: "Rule", kind: "node", details: "Kết quả đơn giản" },
            { id: "n3", label: "Workflow", kind: "node", details: "Quy trình nhiều bước" },
          ],
          relationships: [
            { from: "n1", to: "n2", label: "CÓ" },
            { from: "n1", to: "n3", label: "KHÔNG" },
          ],
          key_facts: ["Nhánh CÓ từ n1 dẫn tới Rule."],
        }
      : {
          note: "",
          questions: [{
            q: "Khi bài toán có quy tắc rõ ràng, cây quyết định dẫn tới lựa chọn nào?",
            options: [
              "Rule",
              "Workflow",
              "Agent",
              "Không chọn giải pháp",
            ],
            correct: 0,
            excerpt: "n1 --CÓ--> n2",
            why_wrong: [
              "Nhánh CÓ dẫn tới Rule.",
              "Nhánh CÓ dẫn tới Rule.",
              "Cây vẫn đưa ra lựa chọn.",
            ],
          }],
        };
    return new Response(JSON.stringify({
      id: isVision ? "vision-request" : "quiz-request",
      model: isVision ? "vision-model" : "text-model",
      choices: [{ message: { content: JSON.stringify(content) } }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const answer = await runAgent({
      question: "",
      mode: "quiz",
      document: "d2-slide-hackathon.pdf",
      page: 21,
      slide_text: "Cây quyết định: Lựa chọn cấp độ giải pháp — Rule, Workflow hay Agent",
      image_data_url: "data:image/jpeg;base64,dGVzdA==",
    }, {
      AI_API_KEY: "text-key",
      AI_BASE_URL: "https://text.example.test/v1",
      AI_MODEL: "text-model",
      VISION_API_KEY: "vision-key",
      VISION_BASE_URL: "https://vision.example.test/v1",
      VISION_MODEL: "vision-model",
    }, new AbortController().signal);

    assert.equal(requests.length, 2);
    assert.ok(Array.isArray(requests[0].messages[1].content));
    assert.match(requests[1].messages[1].content, /VISION DESCRIPTION/);
    assert.equal(answer.kind, "quiz");
    assert.equal(answer.questions.length, 1);
    assert.equal(answer.questions[0].origin, "vision");
    assert.equal(answer.meta.vision_model, "vision-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat requests forward provider SSE deltas before returning the validated result", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  const modelJson = JSON.stringify({
    intent: "question",
    scope: "course",
    conf: 80,
    kind: "answered",
    body: ["Problem Discovery giúp làm rõ bài toán [trang 2]"],
    sources: [],
  });
  const splitAt = Math.floor(modelJson.length / 2);
  const chunks = [modelJson.slice(0, splitAt), modelJson.slice(splitAt)];

  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    const sse = chunks
      .map((content, index) => `data: ${JSON.stringify({
        id: "stream-request",
        model: "stream-model",
        choices: [{ delta: { content }, index: 0 }],
      })}\n\n`)
      .join("") + "data: [DONE]\n\n";
    return new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const deltas = [];
  try {
    const answer = await runAgent({
      question: "Problem Discovery dùng để làm gì?",
      document: "d2-slide-hackathon.pdf",
      page: 2,
    }, {
      AI_API_KEY: "test-key",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "test-model",
    }, new AbortController().signal, (delta) => deltas.push(delta));

    assert.equal(requestBody.stream, true);
    assert.deepEqual(requestBody.stream_options, { include_usage: true });
    assert.equal(deltas.length, 2);
    assert.equal(deltas.join(""), modelJson);
    assert.equal(answer.kind, "answered");
    assert.match(answer.body[0], /Problem Discovery/);
    assert.equal(answer.meta.model, "stream-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
