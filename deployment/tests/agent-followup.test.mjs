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

test("quiz mode uses vision description before the quiz LLM for a thin page", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    requests.push(request);
    const isVision = Array.isArray(request.messages[1].content);
    const content = isVision
      ? {
          description: "Trang tiêu đề giới thiệu AI IN ACTION - HACKATHON.",
          visible_text: "AI IN ACTION - HACKATHON",
          key_facts: ["Nội dung nhìn thấy là tiêu đề AI IN ACTION - HACKATHON."],
        }
      : {
          note: "",
          questions: [{
            q: "Tiêu đề nào xuất hiện trên trang?",
            options: [
              "AI IN ACTION - HACKATHON",
              "Machine Learning Basics",
              "Data Engineering Lab",
              "Final Examination",
            ],
            correct: 0,
            excerpt: "AI IN ACTION - HACKATHON",
            why_wrong: [
              "Không xuất hiện trong mô tả ảnh.",
              "Không xuất hiện trong mô tả ảnh.",
              "Không xuất hiện trong mô tả ảnh.",
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
      page: 1,
      slide_text: "AI IN ACTION - HACKATHON",
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
    assert.equal(answer.questions[0].origin, "slide");
    assert.equal(answer.meta.vision_model, "vision-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
