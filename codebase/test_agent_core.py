"""Behavioral tests for the context-aware study-agent core."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import agent_core


DOCUMENT = "d2-slide-hackathon.pdf"


def grounded_answer(page: int, pages: tuple[str, ...], **overrides):
    answer = {
        "intent": "question",
        "scope": "course",
        "conf": 90,
        "kind": "answered",
        "body": [f"Nội dung có căn cứ [trang {page}]"],
        "sources": [{"page": page, "text": " ".join(pages[page - 1].split()[:14])}],
    }
    answer.update(overrides)
    return answer


class AgentCoreTests(unittest.TestCase):
    def setUp(self):
        agent_core._RESPONSE_CACHE.clear()
        self.pages = agent_core.document_pages(DOCUMENT)
        self.tempdir = tempfile.TemporaryDirectory()
        self.trace_path = Path(self.tempdir.name) / "trace.jsonl"

    def tearDown(self):
        self.tempdir.cleanup()
        agent_core._RESPONSE_CACHE.clear()

    def test_summary_intent_wins_over_attached_selection(self):
        payload = {
            "question": "Tóm tắt đoạn bôi đen này thành 3 ý",
            "selected_text": "Context: bàn làm việc có hạn",
        }
        self.assertEqual(agent_core.classify(payload), "summary")
        self.assertEqual(
            agent_core.classify({"question": "Summarize this deck in 2 minutes"}),
            "summary",
        )
        self.assertEqual(
            agent_core.resolve_reference(
                {"question": "What does this slide mean?", "page": 7},
                29,
            ),
            {"kind": "current_page", "page": 7},
        )

    def test_summary_followup_keeps_intent_and_allows_ten_items(self):
        payload = {
            "question": "Make it 10 bullets",
            "history": [
                {
                    "role": "assistant",
                    "content": "Bản tóm tắt năm ý",
                    "intent": "summary",
                    "document": DOCUMENT,
                    "page": 1,
                }
            ],
        }
        self.assertEqual(agent_core.classify(payload), "summary")
        profile = agent_core.summary_preferences(payload["question"])
        self.assertEqual(profile["max_items"], 10)
        self.assertEqual(profile["exact_items"], 10)

        payload.update({
            "document": DOCUMENT,
            "_resolved_reference": {"kind": "current_page", "page": 1},
            "_summary_preferences": profile,
        })
        messages = agent_core._build_messages(payload, "summary", "[PAGE 1] Nội dung")
        self.assertIn('"exact_body_items": 10', messages[-1]["content"])

    def test_mojibake_is_repaired_and_bad_image_text_falls_back_to_pdf(self):
        self.assertEqual(
            agent_core.repair_mojibake("SÃ\x81NG - KHUNG LÃ\x9d THUYáº¾T"),
            "SÁNG - KHUNG LÝ THUYẾT",
        )
        evidence, _ = agent_core.gather_evidence(
            {
                "question": "Hình này nói gì?",
                "document": DOCUMENT,
                "page": 1,
                "slide_text": "SÃNG - KHUNG LÃ THUYáº¾T",
                "_resolved_reference": {"kind": "current_page", "page": 1},
            },
            "image",
        )
        first_block = evidence.split("\n\n", 1)[0]
        self.assertIn(self.pages[0][:80], first_block)
        self.assertNotIn("THUYáº¾T", first_block)

    def test_bare_summary_asks_for_purpose_and_reading_budget(self):
        with patch.object(agent_core, "_call_model") as call_model:
            answer = agent_core.run_agent(
                {"question": "Tóm tắt tài liệu", "document": DOCUMENT, "page": 1},
                trace_path=self.trace_path,
            )
        self.assertEqual(answer["kind"], "clarify")
        self.assertIn("bao nhiêu phút", answer["body"][0])
        call_model.assert_not_called()

    def test_topic_focused_summary_is_clear_without_a_manual_time_budget(self):
        profile = agent_core.summary_preferences(
            "Tóm tắt toàn bộ Day 02 nhưng chỉ tập trung vào cost-of-error và mức automation."
        )
        self.assertTrue(profile["clear"])
        self.assertIn("tập trung", profile["purpose"])
        self.assertEqual(profile["estimated_reading_minutes"], 3)

    def test_clear_summary_sends_every_page_and_reports_reading_time(self):
        captured = {}

        def fake_model(payload, intent, evidence, on_delta=None):
            captured["payload"] = payload
            captured["intent"] = intent
            captured["evidence"] = evidence
            return grounded_answer(
                1,
                self.pages,
                intent="summary",
                body=["Tổng quan khóa học [trang 1]"],
            ), {"model": "fake", "usage": {}, "latency_ms": 1}

        with patch.object(agent_core, "_call_model", side_effect=fake_model):
            answer = agent_core.run_agent(
                {
                    "question": "Tóm tắt để ôn tập trong 2 phút, tối đa 5 ý.",
                    "document": DOCUMENT,
                    "page": 1,
                },
                trace_path=self.trace_path,
            )

        self.assertEqual(captured["intent"], "summary")
        for page in range(1, len(self.pages) + 1):
            self.assertIn(f"[PAGE {page}]", captured["evidence"])
        self.assertEqual(captured["payload"]["_summary_preferences"]["estimated_reading_minutes"], 2)
        self.assertEqual(answer["summary"]["coverage_pages"], len(self.pages))
        self.assertGreaterEqual(answer["summary"]["estimated_reading_minutes"], 1)

    def test_explicit_slide_reference_overrides_viewed_page(self):
        captured = {}

        def fake_model(payload, intent, evidence, on_delta=None):
            captured["payload"] = payload
            captured["evidence"] = evidence
            return grounded_answer(3, self.pages), {"model": "fake", "usage": {}}

        with patch.object(agent_core, "_call_model", side_effect=fake_model):
            answer = agent_core.run_agent(
                {
                    "question": "Slide 3 nói về điều gì?",
                    "document": DOCUMENT,
                    "page": 9,
                },
                trace_path=self.trace_path,
            )

        self.assertEqual(captured["payload"]["_resolved_reference"], {"kind": "explicit_page", "page": 3})
        self.assertIn(f"[PRIORITY PAGE 3] {self.pages[2]}", captured["evidence"])
        self.assertEqual(answer["context"]["page"], 3)

    def test_question_evidence_contains_the_whole_deck_for_term_search(self):
        captured = {}

        def fake_model(payload, intent, evidence, on_delta=None):
            captured["evidence"] = evidence
            return grounded_answer(27, self.pages), {"model": "fake", "usage": {}}

        with patch.object(agent_core, "_call_model", side_effect=fake_model):
            answer = agent_core.run_agent(
                {
                    "question": "Problem Statement 6+3 gồm những gì?",
                    "document": DOCUMENT,
                    "page": 1,
                },
                trace_path=self.trace_path,
            )

        self.assertIn("[FULL DOCUMENT", captured["evidence"])
        self.assertIn(f"[PAGE 29] {self.pages[28]}", captured["evidence"])
        self.assertNotIn("[TRANSCRIPT", captured["evidence"])
        self.assertEqual(answer["sources"][0]["page"], 27)

    def test_selection_and_conversation_references_are_preserved(self):
        history = [
            {
                "role": "assistant",
                "content": "Ý trước nói về attention [trang 15]",
                "document": DOCUMENT,
                "page": 15,
            }
        ]
        reference = agent_core.resolve_reference(
            {
                "question": "Còn ý đó thì sao?",
                "document": DOCUMENT,
                "page": 2,
                "history": history,
            },
            len(self.pages),
            history,
        )
        self.assertEqual(reference, {"kind": "conversation", "page": 15})

        evidence, _ = agent_core.gather_evidence(
            {
                "question": "Giải thích đoạn này",
                "document": DOCUMENT,
                "page": 14,
                "selected_text": "Context: bàn làm việc có hạn",
                "_resolved_reference": {"kind": "selected_text", "page": 14},
            },
            "selection",
        )
        self.assertTrue(evidence.startswith("[SELECTED TEXT ON PAGE 14]"))

    def test_history_is_bounded_and_included_as_chat_messages(self):
        history = [
            {"role": "user", "content": f"Câu {index}", "document": DOCUMENT, "page": index}
            for index in range(1, 20)
        ]
        payload = {
            "question": "Còn ý trước?",
            "document": DOCUMENT,
            "page": 1,
            "history": history,
            "_resolved_reference": {"kind": "conversation", "page": 19},
        }
        messages = agent_core._build_messages(payload, "question", "[PAGE 1] Nội dung")
        history_messages = messages[1:-1]
        self.assertEqual(len(history_messages), agent_core.MAX_HISTORY_MESSAGES)
        self.assertIn("Câu 19", history_messages[-1]["content"])
        self.assertIn("trang 19", history_messages[-1]["content"])

    def test_cache_key_changes_with_conversation_context(self):
        base = {"question": "Nó là gì?", "document": DOCUMENT, "page": 1}
        first = agent_core._cache_key(
            {**base, "history": [{"role": "user", "content": "attention"}]},
            "question",
        )
        second = agent_core._cache_key(
            {**base, "history": [{"role": "user", "content": "token"}]},
            "question",
        )
        self.assertNotEqual(first, second)

    def test_outside_scope_cannot_remain_answered(self):
        raw = {
            "intent": "question",
            "scope": "outside",
            "kind": "answered",
            "conf": 99,
            "body": ["Đây là code không thuộc khóa học."],
            "sources": [],
        }
        answer = agent_core._normalize_answer(raw, list(range(1, 30)), self.pages)
        self.assertEqual(answer["kind"], "refuse")
        self.assertNotIn("Đây là code", answer["body"][0])

    def test_answer_that_admits_missing_course_evidence_becomes_clarify(self):
        raw = grounded_answer(
            18,
            self.pages,
            body=[
                "Tài liệu Day 02 không dạy quy trình fine-tuning. Đây là tổng quan khác [trang 18]."
            ],
        )
        answer = agent_core._normalize_answer(raw, list(range(1, 30)), self.pages)
        self.assertEqual(answer["kind"], "clarify")
        self.assertEqual(answer["analysis"]["scope"], "uncertain")
        self.assertEqual(answer["sources"], [])

    def test_summary_item_limit_merges_late_topics_instead_of_dropping_them(self):
        raw = grounded_answer(
            28,
            self.pages,
            intent="summary",
            body=[
                "Điểm một",
                "Điểm hai",
                "Điểm ba",
                "Điểm bốn",
                "Go",
                "Not Yet và No-Go",
            ],
        )
        answer = agent_core._normalize_answer(
            raw,
            list(range(1, 30)),
            self.pages,
            body_limit=5,
            intent="summary",
        )
        self.assertEqual(len(answer["body"]), 5)
        self.assertIn("Go", answer["body"][-1])
        self.assertIn("Not Yet", answer["body"][-1])

    def test_openai_compatible_sse_tokens_are_forwarded(self):
        events = [
            {"id": "req-1", "model": "fake", "choices": [{"delta": {"content": '{"body":['}}]},
            {"choices": [{"delta": {"content": '"Xin chào"]}'}}], "usage": {"total_tokens": 4}},
        ]

        class FakeResponse:
            def iter_lines(self, decode_unicode=True):
                for event in events:
                    yield "data: " + json.dumps(event)
                yield "data: [DONE]"

        deltas = []
        raw = agent_core._decode_stream_response(FakeResponse(), deltas.append)
        self.assertEqual("".join(deltas), '{"body":["Xin chào"]}')
        self.assertEqual(raw["id"], "req-1")
        self.assertEqual(raw["usage"]["total_tokens"], 4)

    def test_official_deepseek_calls_disable_thinking_mode(self):
        class FakeResponse:
            ok = True
            status_code = 200
            headers = {}

            def json(self):
                return {
                    "id": "req-2",
                    "model": "deepseek-v4-flash",
                    "choices": [{
                        "message": {
                            "content": json.dumps({
                                "intent": "question",
                                "scope": "course",
                                "conf": 90,
                                "kind": "answered",
                                "body": ["Có căn cứ [trang 1]"],
                                "sources": [],
                            })
                        }
                    }],
                    "usage": {},
                }

        payload = {
            "question": "Slide này nói gì?",
            "document": DOCUMENT,
            "page": 1,
            "_resolved_reference": {"kind": "current_page", "page": 1},
        }
        with patch.object(
                agent_core,
                "_provider_config",
                return_value=("secret", "https://api.deepseek.com", "deepseek-v4-flash"),
            ):
            with patch.object(agent_core.requests, "post", return_value=FakeResponse()) as post:
                agent_core._call_model(payload, "question", "[PAGE 1] Có căn cứ")

        self.assertEqual(post.call_args.kwargs["json"]["thinking"], {"type": "disabled"})


if __name__ == "__main__":
    unittest.main()
