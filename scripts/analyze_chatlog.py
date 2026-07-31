#!/usr/bin/env python3
"""Generate reproducible evidence from a row-oriented chatlog CSV.

The script detects the required columns from header aliases, reconstructs
student/tutor QA pairs, applies transparent keyword heuristics, and writes a
machine-readable summary plus human-auditable examples and documentation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


SUMMARY_KEYWORDS = [
    "tóm tắt",
    "tóm gọn",
    "tổng hợp",
    "summary",
    "ý chính",
    "nội dung chính",
    "cần nhớ",
    "cần học",
    "ghi chú",
    "note",
]

VISUAL_KEYWORDS = [
    "hình",
    "ảnh",
    "bảng",
    "biểu đồ",
    "sơ đồ",
    "khoanh",
    "mũi tên",
    "trục",
    "nhánh màu",
    "phần này",
    "cái này",
]

FAILURE_KEYWORDS = [
    "không thể xác định",
    "không nhìn thấy",
    "không có thông tin",
    "không tìm thấy",
    "vui lòng cung cấp thêm",
]

CITATION_EMPTY_SENTINELS = {
    "",
    "[]",
    "{}",
    "null",
    "none",
    "nan",
    "na",
    "n/a",
}

COLUMN_ALIASES = {
    "conversation_id": [
        "conversation_id",
        "conversation",
        "conversationid",
        "chat_id",
        "chatid",
        "session_id",
        "sessionid",
        "thread_id",
        "threadid",
        "hoi_thoai",
        "ma_hoi_thoai",
    ],
    "turn_id": [
        "turn_id",
        "turn",
        "turnid",
        "qa_id",
        "qaid",
        "exchange_id",
        "exchangeid",
    ],
    "role": [
        "role",
        "speaker",
        "sender_role",
        "senderrole",
        "author_role",
        "authorrole",
        "sender_type",
        "sendertype",
    ],
    "content": [
        "content",
        "message",
        "message_text",
        "messagetext",
        "text",
        "body",
        "prompt",
    ],
    "citations": [
        "citations",
        "citation",
        "sources",
        "source",
        "references",
        "reference",
    ],
    "timestamp": [
        "message_created_at",
        "messagecreatedat",
        "created_at",
        "createdat",
        "timestamp",
        "sent_at",
        "sentat",
        "time",
    ],
    "message_id": [
        "message_id",
        "messageid",
        "msg_id",
        "msgid",
        "id",
    ],
}

REQUIRED_COLUMNS = ("conversation_id", "role", "content", "citations")

STUDENT_ROLES = {
    "student",
    "learner",
    "user",
    "human",
    "hocvien",
    "hocsinh",
}

TUTOR_ROLES = {
    "tutor",
    "teacher",
    "assistant",
    "bot",
    "ai",
    "giaovien",
}

EXAMPLE_CATEGORIES = (
    "summary_without_citation",
    "visual_failure",
    "summary_success",
    "visual_success",
    "borderline_case",
)

EXAMPLES_PER_CATEGORY = 5

EMAIL_RE = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    flags=re.IGNORECASE,
)

VN_PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?84|0)(?:[\s.\-]?\d){9,10}(?!\d)"
)


class AnalysisError(RuntimeError):
    """A clear, user-actionable analysis failure."""


@dataclass(frozen=True)
class Message:
    row_number: int
    conversation_id: str
    turn_id: str
    role: str
    content: str
    citations: Any
    timestamp: str


@dataclass(frozen=True)
class QAPair:
    conversation_id: str
    turn_id: str
    student: Message
    tutor: Message


@dataclass(frozen=True)
class ClassifiedPair:
    pair: QAPair
    summary_keywords: tuple[str, ...]
    visual_keywords: tuple[str, ...]
    failure_keywords: tuple[str, ...]
    citation_is_empty: bool
    citation_empty_reason: str

    @property
    def is_summary(self) -> bool:
        return bool(self.summary_keywords)

    @property
    def is_visual(self) -> bool:
        return bool(self.visual_keywords)

    @property
    def is_visual_failure(self) -> bool:
        return self.is_visual and bool(self.failure_keywords)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze a chatlog CSV and generate reproducible evidence."
    )
    parser.add_argument("--input", required=True, help="Path to the chatlog CSV.")
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory for summary.json, examples.csv, analysis_log.txt, and evidence.md.",
    )
    return parser.parse_args(argv)


def normalized_token(value: Any) -> str:
    """Normalize identifiers/roles while retaining Vietnamese alias support."""
    text = unicodedata.normalize("NFKD", str(value or "").strip().casefold())
    without_marks = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", without_marks)


def normalized_text(value: Any) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).casefold()


def detect_columns(fieldnames: Sequence[str] | None) -> dict[str, str | None]:
    if not fieldnames:
        raise AnalysisError("CSV không có header hoặc header rỗng.")

    duplicate_headers = [
        name for name, count in Counter(fieldnames).items() if count > 1
    ]
    if duplicate_headers:
        raise AnalysisError(
            "CSV có tên cột trùng lặp: " + ", ".join(repr(name) for name in duplicate_headers)
        )

    normalized_headers: dict[str, list[str]] = defaultdict(list)
    for header in fieldnames:
        normalized_headers[normalized_token(header)].append(header)

    detected: dict[str, str | None] = {}
    for semantic_name, aliases in COLUMN_ALIASES.items():
        matches: list[str] = []
        for alias in aliases:
            matches.extend(normalized_headers.get(normalized_token(alias), []))
        matches = list(dict.fromkeys(matches))
        if len(matches) > 1:
            raise AnalysisError(
                f"Không thể tự chọn cột {semantic_name!r}; nhiều cột cùng khớp alias: "
                + ", ".join(repr(match) for match in matches)
            )
        detected[semantic_name] = matches[0] if matches else None

    missing = [name for name in REQUIRED_COLUMNS if not detected[name]]
    if missing:
        available = ", ".join(fieldnames)
        raise AnalysisError(
            "Thiếu cột bắt buộc sau khi tự nhận diện: "
            + ", ".join(missing)
            + f". Header hiện có: {available}"
        )
    return detected


def canonical_role(raw_role: Any) -> str | None:
    role = normalized_token(raw_role)
    if role in STUDENT_ROLES:
        return "student"
    if role in TUTOR_ROLES:
        return "tutor"
    return None


def get_value(row: dict[str | None, Any], column: str | None) -> Any:
    return row.get(column) if column else None


def load_messages(
    input_path: Path,
    detected: dict[str, str | None],
) -> tuple[list[Message], dict[str, int], list[str], list[str]]:
    messages: list[Message] = []
    skipped = Counter()
    warnings: list[str] = []
    malformed_rows: list[str] = []

    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for csv_row_number, row in enumerate(reader, start=2):
            if None in row:
                malformed_rows.append(
                    f"dòng CSV {csv_row_number}: có {len(row[None])} field dư so với header"
                )
                skipped["malformed_rows"] += 1
                continue

            conversation_id = str(
                get_value(row, detected["conversation_id"]) or ""
            ).strip()
            if not conversation_id:
                skipped["missing_conversation_id"] += 1
                continue

            role = canonical_role(get_value(row, detected["role"]))
            if not role:
                skipped["unknown_role"] += 1
                continue

            content_value = get_value(row, detected["content"])
            if content_value is None:
                skipped["missing_content"] += 1
                continue

            messages.append(
                Message(
                    row_number=csv_row_number,
                    conversation_id=conversation_id,
                    turn_id=str(get_value(row, detected["turn_id"]) or "").strip(),
                    role=role,
                    content=str(content_value),
                    citations=get_value(row, detected["citations"]),
                    timestamp=str(get_value(row, detected["timestamp"]) or "").strip(),
                )
            )

    if malformed_rows:
        warnings.extend(malformed_rows[:10])
        if len(malformed_rows) > 10:
            warnings.append(
                f"... và {len(malformed_rows) - 10} dòng malformed khác"
            )
    return messages, dict(skipped), warnings, malformed_rows


def parse_timestamp(value: str) -> float | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def chronological_key(message: Message) -> tuple[int, float, int]:
    timestamp = parse_timestamp(message.timestamp)
    if timestamp is None:
        return (1, float(message.row_number), message.row_number)
    return (0, timestamp, message.row_number)


def pair_sequentially(messages: Iterable[Message]) -> tuple[list[QAPair], list[Message], list[Message]]:
    """Pair the closest pending student with the next tutor per conversation."""
    conversations: dict[str, list[Message]] = defaultdict(list)
    for message in messages:
        conversations[message.conversation_id].append(message)

    pairs: list[QAPair] = []
    unmatched_students: list[Message] = []
    unmatched_tutors: list[Message] = []

    for conversation_id, conversation_messages in conversations.items():
        ordered = sorted(conversation_messages, key=chronological_key)
        pending_student: Message | None = None
        for message in ordered:
            if message.role == "student":
                if pending_student is not None:
                    unmatched_students.append(pending_student)
                pending_student = message
                continue

            if pending_student is None:
                unmatched_tutors.append(message)
                continue

            fallback_turn_id = pending_student.turn_id or f"row_{pending_student.row_number}"
            pairs.append(
                QAPair(
                    conversation_id=conversation_id,
                    turn_id=fallback_turn_id,
                    student=pending_student,
                    tutor=message,
                )
            )
            pending_student = None

        if pending_student is not None:
            unmatched_students.append(pending_student)

    return pairs, unmatched_students, unmatched_tutors


def create_qa_pairs(
    messages: Sequence[Message],
    has_turn_column: bool,
) -> tuple[list[QAPair], dict[str, int], list[str], str]:
    pairs: list[QAPair] = []
    warnings: list[str] = []
    diagnostics = Counter()
    fallback_messages: list[Message] = []

    if has_turn_column:
        turn_groups: dict[tuple[str, str], list[Message]] = defaultdict(list)
        for message in messages:
            if message.turn_id:
                turn_groups[(message.conversation_id, message.turn_id)].append(message)
            else:
                fallback_messages.append(message)

        for (conversation_id, turn_id), group in sorted(
            turn_groups.items(), key=lambda item: min(row.row_number for row in item[1])
        ):
            students = sorted(
                (row for row in group if row.role == "student"),
                key=lambda row: row.row_number,
            )
            tutors = sorted(
                (row for row in group if row.role == "tutor"),
                key=lambda row: row.row_number,
            )
            pair_count = min(len(students), len(tutors))

            for index in range(pair_count):
                student = students[index]
                tutor = tutors[index]
                if tutor.row_number < student.row_number:
                    diagnostics["tutor_before_student_in_input"] += 1
                pairs.append(
                    QAPair(
                        conversation_id=conversation_id,
                        turn_id=turn_id,
                        student=student,
                        tutor=tutor,
                    )
                )

            diagnostics["unmatched_student_rows"] += max(
                0, len(students) - pair_count
            )
            diagnostics["unmatched_tutor_rows"] += max(0, len(tutors) - pair_count)
            if len(students) != 1 or len(tutors) != 1:
                warnings.append(
                    f"{conversation_id}/{turn_id}: tìm thấy {len(students)} student "
                    f"và {len(tutors)} tutor"
                )

        method = (
            "Ghép theo (conversation_id, turn_id); mỗi turn hợp lệ ghép student "
            "với tutor thuộc cùng turn."
        )
    else:
        fallback_messages = list(messages)
        method = (
            "Không có turn_id; sắp theo timestamp (fallback: thứ tự dòng) trong "
            "conversation_id rồi ghép student với tutor kế tiếp."
        )

    if fallback_messages:
        fallback_pairs, fallback_students, fallback_tutors = pair_sequentially(
            fallback_messages
        )
        pairs.extend(fallback_pairs)
        diagnostics["fallback_pairs"] = len(fallback_pairs)
        diagnostics["unmatched_student_rows"] += len(fallback_students)
        diagnostics["unmatched_tutor_rows"] += len(fallback_tutors)
        method += (
            f" {len(fallback_messages)} dòng thiếu turn_id được xử lý bằng fallback "
            "theo thời gian/thứ tự dòng."
        )

    pairs.sort(key=lambda pair: pair.student.row_number)
    diagnostics["qa_pairs"] = len(pairs)
    diagnostics["fallback_rows"] = len(fallback_messages)

    if diagnostics["tutor_before_student_in_input"]:
        warnings.append(
            f"{diagnostics['tutor_before_student_in_input']} cặp có tutor đứng trước "
            "student trong thứ tự CSV; đã khôi phục bằng turn_id."
        )
    if diagnostics["unmatched_student_rows"]:
        warnings.append(
            f"{diagnostics['unmatched_student_rows']} dòng student không ghép được."
        )
    if diagnostics["unmatched_tutor_rows"]:
        warnings.append(
            f"{diagnostics['unmatched_tutor_rows']} dòng tutor không ghép được."
        )
    if not pairs:
        raise AnalysisError(
            "Không tạo được cặp hỏi–đáp nào. Kiểm tra role, conversation_id, "
            "turn_id/timestamp và thứ tự dữ liệu."
        )

    return pairs, dict(diagnostics), warnings, method


def semantically_empty(value: Any, *, depth: int = 0) -> bool:
    if depth > 4:
        return False
    if value is None:
        return True
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.casefold() in CITATION_EMPTY_SENTINELS:
            return True
        try:
            parsed = json.loads(stripped)
        except (json.JSONDecodeError, TypeError):
            return False
        if parsed == value:
            return False
        return semantically_empty(parsed, depth=depth + 1)
    if isinstance(value, (list, tuple, set)):
        return not value or all(
            semantically_empty(item, depth=depth + 1) for item in value
        )
    if isinstance(value, dict):
        return not value or all(
            semantically_empty(item, depth=depth + 1) for item in value.values()
        )
    return False


def citation_empty_reason(value: Any) -> str:
    if value is None:
        return "null"
    stripped = str(value).strip()
    if not stripped:
        return "chuỗi rỗng"
    if stripped.casefold() in CITATION_EMPTY_SENTINELS:
        return f"giá trị rỗng tương đương {stripped!r}"
    try:
        parsed = json.loads(stripped)
    except (json.JSONDecodeError, TypeError):
        return "không rỗng"
    if semantically_empty(parsed):
        return "JSON rỗng hoặc chỉ chứa giá trị rỗng"
    return "không rỗng"


def matching_keywords(text: str, keywords: Sequence[str]) -> tuple[str, ...]:
    normalized = normalized_text(text)
    return tuple(keyword for keyword in keywords if normalized_text(keyword) in normalized)


def classify_pairs(pairs: Sequence[QAPair]) -> list[ClassifiedPair]:
    classified: list[ClassifiedPair] = []
    for pair in pairs:
        citation_is_empty = semantically_empty(pair.tutor.citations)
        classified.append(
            ClassifiedPair(
                pair=pair,
                summary_keywords=matching_keywords(
                    pair.student.content, SUMMARY_KEYWORDS
                ),
                visual_keywords=matching_keywords(
                    pair.student.content, VISUAL_KEYWORDS
                ),
                failure_keywords=matching_keywords(
                    pair.tutor.content, FAILURE_KEYWORDS
                ),
                citation_is_empty=citation_is_empty,
                citation_empty_reason=citation_empty_reason(pair.tutor.citations),
            )
        )
    return classified


def ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 6) if denominator else 0.0


def keyword_counts(
    classified: Sequence[ClassifiedPair],
    attribute: str,
    keywords: Sequence[str],
) -> dict[str, int]:
    counts = Counter()
    for item in classified:
        counts.update(getattr(item, attribute))
    return {keyword: counts.get(keyword, 0) for keyword in keywords}


def build_summary(
    *,
    input_argument: str,
    input_path: Path,
    rows_loaded: int,
    classified: Sequence[ClassifiedPair],
    pairing_diagnostics: dict[str, int],
    pairing_method: str,
    detected: dict[str, str | None],
    skipped: dict[str, int],
) -> dict[str, Any]:
    total = len(classified)
    summaries = [item for item in classified if item.is_summary]
    summary_without = [
        item for item in summaries if item.citation_is_empty
    ]
    visuals = [item for item in classified if item.is_visual]
    visual_failures = [item for item in visuals if item.is_visual_failure]
    citation_empty_pairs = [
        item for item in classified if item.citation_is_empty
    ]
    visual_empty = [item for item in visuals if item.citation_is_empty]
    visual_failure_empty = [
        item for item in visual_failures if item.citation_is_empty
    ]
    overlaps = [
        item for item in classified if item.is_summary and item.is_visual
    ]

    with input_path.open("rb") as handle:
        input_sha256 = hashlib.sha256(handle.read()).hexdigest()

    return {
        "total_qa_pairs": total,
        "summary_requests": len(summaries),
        "summary_without_citations": len(summary_without),
        "visual_requests": len(visuals),
        "visual_failures": len(visual_failures),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_file": input_argument,
        "keyword_rules": {
            "match_behavior": (
                "Unicode NFKC + case-insensitive literal substring matching; "
                "summary/visual rules inspect student_prompt and failure rules "
                "inspect tutor_answer."
            ),
            "summary_request": SUMMARY_KEYWORDS,
            "visual_request": VISUAL_KEYWORDS,
            "visual_failure": FAILURE_KEYWORDS,
            "citation_empty": {
                "sentinels": sorted(CITATION_EMPTY_SENTINELS),
                "json_semantics": (
                    "null, empty strings, empty lists/dicts, or containers whose "
                    "values are all semantically empty"
                ),
            },
        },
        "rows_loaded": rows_loaded,
        "input_sha256": input_sha256,
        "detected_columns": detected,
        "pairing_method": pairing_method,
        "pairing_diagnostics": pairing_diagnostics,
        "skipped_rows": skipped,
        "citation_empty_pairs": len(citation_empty_pairs),
        "citation_nonempty_pairs": total - len(citation_empty_pairs),
        "summary_with_citations": len(summaries) - len(summary_without),
        "summary_request_rate": ratio(len(summaries), total),
        "summary_without_citations_rate": ratio(
            len(summary_without), len(summaries)
        ),
        "visual_successes": len(visuals) - len(visual_failures),
        "visual_failure_rate": ratio(len(visual_failures), len(visuals)),
        "visual_with_empty_citations": len(visual_empty),
        "visual_with_citations": len(visuals) - len(visual_empty),
        "visual_failures_without_citations": len(visual_failure_empty),
        "visual_failures_with_citations": (
            len(visual_failures) - len(visual_failure_empty)
        ),
        "summary_visual_overlap": len(overlaps),
        "neither_summary_nor_visual": sum(
            not item.is_summary and not item.is_visual for item in classified
        ),
        "counts_by_summary_keyword": keyword_counts(
            classified, "summary_keywords", SUMMARY_KEYWORDS
        ),
        "counts_by_visual_keyword": keyword_counts(
            classified, "visual_keywords", VISUAL_KEYWORDS
        ),
        "counts_by_failure_keyword": keyword_counts(
            classified, "failure_keywords", FAILURE_KEYWORDS
        ),
    }


def borderline_reason(item: ClassifiedPair) -> str | None:
    if item.is_summary and item.is_visual:
        return (
            "Prompt đồng thời khớp rule summary và visual; phân loại phụ thuộc "
            "mục tiêu phân tích."
        )
    visual_set = set(item.visual_keywords)
    if visual_set and visual_set.issubset({"phần này", "cái này"}):
        return (
            "Chỉ khớp từ chỉ xuất chung chung ('phần này'/'cái này'), nên có thể "
            "không thật sự cần dữ liệu hình ảnh."
        )
    summary_set = set(item.summary_keywords)
    if summary_set == {"note"}:
        return (
            "Chỉ khớp từ tiếng Anh 'note'; substring heuristic có thể nhầm ngữ cảnh."
        )
    return None


def sort_key(item: ClassifiedPair) -> tuple[str, str, int]:
    pair = item.pair
    return (
        pair.conversation_id,
        pair.turn_id,
        pair.student.row_number,
    )


def redact_obvious_pii(text: str) -> tuple[str, int]:
    redactions = 0

    def replace_email(_: re.Match[str]) -> str:
        nonlocal redactions
        redactions += 1
        return "[REDACTED_EMAIL]"

    def replace_phone(_: re.Match[str]) -> str:
        nonlocal redactions
        redactions += 1
        return "[REDACTED_PHONE]"

    text = EMAIL_RE.sub(replace_email, text)
    text = VN_PHONE_RE.sub(replace_phone, text)
    return text, redactions


def matched_keyword_label(item: ClassifiedPair) -> str:
    parts = []
    if item.summary_keywords:
        parts.append("summary:" + "|".join(item.summary_keywords))
    if item.visual_keywords:
        parts.append("visual:" + "|".join(item.visual_keywords))
    if item.failure_keywords:
        parts.append("failure:" + "|".join(item.failure_keywords))
    return "; ".join(parts)


def choose_examples(
    classified: Sequence[ClassifiedPair],
) -> tuple[list[dict[str, str]], list[str], int]:
    ordered = sorted(classified, key=sort_key)
    candidates: dict[str, list[ClassifiedPair]] = {
        "summary_without_citation": [
            item
            for item in ordered
            if item.is_summary and item.citation_is_empty
        ],
        "visual_failure": [
            item for item in ordered if item.is_visual_failure
        ],
        "summary_success": [
            item
            for item in ordered
            if item.is_summary and not item.citation_is_empty
        ],
        "visual_success": [
            item
            for item in ordered
            if item.is_visual and not item.is_visual_failure
        ],
        "borderline_case": [
            item for item in ordered if borderline_reason(item) is not None
        ],
    }

    selected: dict[str, list[ClassifiedPair]] = {}
    used_pairs: set[tuple[str, str]] = set()
    warnings: list[str] = []

    for category in EXAMPLE_CATEGORIES:
        distinct = [
            item
            for item in candidates[category]
            if (item.pair.conversation_id, item.pair.turn_id) not in used_pairs
        ]
        chosen = distinct[:EXAMPLES_PER_CATEGORY]
        if len(chosen) < EXAMPLES_PER_CATEGORY:
            # Reuse a multi-label case only when the dataset has too few distinct cases.
            chosen_keys = {
                (item.pair.conversation_id, item.pair.turn_id) for item in chosen
            }
            for item in candidates[category]:
                key = (item.pair.conversation_id, item.pair.turn_id)
                if key not in chosen_keys:
                    chosen.append(item)
                    chosen_keys.add(key)
                if len(chosen) == EXAMPLES_PER_CATEGORY:
                    break
        selected[category] = chosen
        used_pairs.update(
            (item.pair.conversation_id, item.pair.turn_id) for item in chosen
        )
        if len(chosen) < EXAMPLES_PER_CATEGORY:
            warnings.append(
                f"Category {category!r} chỉ có {len(chosen)} ứng viên; "
                f"không thể xuất đủ {EXAMPLES_PER_CATEGORY} ví dụ mà không bịa dữ liệu."
            )

    records: list[dict[str, str]] = []
    pii_redactions = 0
    for category in EXAMPLE_CATEGORIES:
        for item in selected[category]:
            pair = item.pair
            prompt, prompt_redactions = redact_obvious_pii(pair.student.content)
            answer, answer_redactions = redact_obvious_pii(pair.tutor.content)
            pii_redactions += prompt_redactions + answer_redactions

            if category == "summary_without_citation":
                reason = (
                    f"Prompt khớp {', '.join(item.summary_keywords)}; citation rỗng "
                    f"({item.citation_empty_reason})."
                )
            elif category == "visual_failure":
                reason = (
                    f"Prompt khớp {', '.join(item.visual_keywords)}; tutor khớp "
                    f"failure phrase {', '.join(item.failure_keywords)}."
                )
            elif category == "summary_success":
                reason = (
                    f"Prompt khớp {', '.join(item.summary_keywords)} và citation "
                    "không rỗng."
                )
            elif category == "visual_success":
                reason = (
                    f"Prompt khớp {', '.join(item.visual_keywords)}; tutor không "
                    "khớp failure phrase nào."
                )
            else:
                reason = borderline_reason(item) or "Ca biên theo heuristic."

            if prompt_redactions or answer_redactions:
                reason += " Đã che email/số điện thoại có dạng PII trong bản evidence."

            records.append(
                {
                    "category": category,
                    "conversation_id": pair.conversation_id,
                    "turn_id": pair.turn_id,
                    "student_prompt": prompt,
                    "tutor_answer": answer,
                    "citations": (
                        "" if pair.tutor.citations is None else str(pair.tutor.citations)
                    ),
                    "matched_keywords": matched_keyword_label(item),
                    "reason_selected": reason,
                }
            )
    return records, warnings, pii_redactions


EXAMPLE_HEADERS = [
    "category",
    "conversation_id",
    "turn_id",
    "student_prompt",
    "tutor_answer",
    "citations",
    "matched_keywords",
    "reason_selected",
]


def render_examples_csv(
    records: Sequence[dict[str, str]],
) -> tuple[str, list[int]]:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(
        buffer,
        fieldnames=EXAMPLE_HEADERS,
        extrasaction="raise",
        lineterminator="\n",
    )
    writer.writeheader()
    start_lines: list[int] = []
    for record in records:
        start_lines.append(buffer.getvalue().count("\n") + 1)
        writer.writerow(record)
    return buffer.getvalue(), start_lines


def markdown_fence(text: str) -> str:
    longest_run = max(
        (len(match.group(0)) for match in re.finditer(r"`+", text)),
        default=0,
    )
    fence = "`" * max(3, longest_run + 1)
    return f"{fence}\n{text}\n{fence}"


def percent(value: float) -> str:
    return f"{value * 100:.2f}%"


def build_evidence_markdown(
    summary: dict[str, Any],
    records: Sequence[dict[str, str]],
    start_lines: Sequence[int],
) -> str:
    indexed_records = list(zip(records, start_lines))
    issue_records = {
        category: [
            (record, line)
            for record, line in indexed_records
            if record["category"] == category
        ]
        for category in ("summary_without_citation", "visual_failure")
    }

    lines = [
        "# Evidence: phân tích chatlog",
        "",
        "## 1. Nguồn dữ liệu",
        "",
        (
            f"Phân tích file `{summary['input_file']}` (SHA-256 "
            f"`{summary['input_sha256']}`), gồm {summary['rows_loaded']:,} dòng. "
            f"Script tạo được **{summary['total_qa_pairs']:,} cặp hỏi–đáp**."
        ),
        "",
        "## 2. Cách ghép hỏi–đáp",
        "",
        summary["pairing_method"],
        "",
        (
            "Lý do ưu tiên `turn_id`: file xuất có thể đặt tutor trước student dù hai "
            "message thuộc cùng một turn. Nếu không có `turn_id`, script sắp theo "
            "timestamp (fallback là thứ tự dòng) trong từng hội thoại và ghép student "
            "với tutor kế tiếp."
        ),
        "",
        "## 3. Định nghĩa heuristic",
        "",
        (
            "- **Yêu cầu tóm tắt:** prompt student chứa ít nhất một keyword: "
            + ", ".join(f"`{keyword}`" for keyword in SUMMARY_KEYWORDS)
            + "."
        ),
        (
            "- **Câu hỏi hình ảnh:** prompt student chứa ít nhất một keyword: "
            + ", ".join(f"`{keyword}`" for keyword in VISUAL_KEYWORDS)
            + "."
        ),
        (
            "- **Citation rỗng:** null, chuỗi rỗng, `[]`, `{}`, sentinel tương đương "
            "(`none`, `nan`, `na`, `n/a`) hoặc JSON chỉ chứa giá trị rỗng."
        ),
        (
            "- **Visual failure:** câu trả lời tutor của một visual request chứa ít "
            "nhất một phrase: "
            + ", ".join(f"`{keyword}`" for keyword in FAILURE_KEYWORDS)
            + "."
        ),
        "",
        (
            "Mọi phép dò dùng Unicode NFKC, không phân biệt hoa/thường và literal "
            "substring. Chi tiết rule máy đọc được nằm trong `summary.json`."
        ),
        "",
        "## 4. Kết quả",
        "",
        "| Chỉ số | Số lượng | Tỷ lệ |",
        "|---|---:|---:|",
        (
            f"| Tổng cặp hỏi–đáp | {summary['total_qa_pairs']:,} | 100.00% |"
        ),
        (
            f"| Yêu cầu tóm tắt | {summary['summary_requests']:,} | "
            f"{percent(summary['summary_request_rate'])} trên tổng cặp |"
        ),
        (
            f"| Tóm tắt không citation | {summary['summary_without_citations']:,} | "
            f"{percent(summary['summary_without_citations_rate'])} trên yêu cầu tóm tắt |"
        ),
        (
            f"| Tóm tắt có citation | {summary['summary_with_citations']:,} | "
            f"{percent(ratio(summary['summary_with_citations'], summary['summary_requests']))} "
            "trên yêu cầu tóm tắt |"
        ),
        (
            f"| Câu hỏi hình ảnh | {summary['visual_requests']:,} | "
            f"{percent(ratio(summary['visual_requests'], summary['total_qa_pairs']))} "
            "trên tổng cặp |"
        ),
        (
            f"| Visual failure | {summary['visual_failures']:,} | "
            f"{percent(summary['visual_failure_rate'])} trên câu hỏi hình ảnh |"
        ),
        (
            f"| Visual success theo rule | {summary['visual_successes']:,} | "
            f"{percent(ratio(summary['visual_successes'], summary['visual_requests']))} "
            "trên câu hỏi hình ảnh |"
        ),
        (
            f"| Citation rỗng ở mọi cặp | {summary['citation_empty_pairs']:,} | "
            f"{percent(ratio(summary['citation_empty_pairs'], summary['total_qa_pairs']))} "
            "trên tổng cặp |"
        ),
        "",
        (
            "Các nhóm có thể chồng lấn: "
            f"{summary['summary_visual_overlap']:,} prompt đồng thời khớp summary và visual."
        ),
        "",
        "## 5. Ví dụ kiểm chứng",
        "",
        (
            "Mỗi liên kết dưới đây trỏ tới dòng vật lý bắt đầu của record tương ứng "
            "trong `examples.csv`. Trường nhiều dòng vẫn được giữ nguyên bằng CSV quoting."
        ),
        "",
    ]

    issue_titles = {
        "summary_without_citation": "Summary không có citation",
        "visual_failure": "Visual failure",
    }
    for category, title in issue_titles.items():
        lines.extend([f"### {title}", ""])
        examples = issue_records[category]
        if not examples:
            lines.extend(
                [
                    "_Không có ví dụ nào trong dữ liệu; script không tạo ví dụ giả._",
                    "",
                ]
            )
            continue

        for index, (record, start_line) in enumerate(examples, start=1):
            lines.extend(
                [
                    (
                        f"#### Ví dụ {index}: `{record['conversation_id']}` / "
                        f"`{record['turn_id']}` — "
                        f"[examples.csv, dòng {start_line}](examples.csv#L{start_line})"
                    ),
                    "",
                    "Student prompt:",
                    "",
                    markdown_fence(record["student_prompt"]),
                    "",
                    "Tutor answer:",
                    "",
                    markdown_fence(record["tutor_answer"]),
                    "",
                    f"Citations: `{record['citations']}`",
                    "",
                ]
            )

    lines.extend(
        [
            "## 6. Hạn chế",
            "",
            (
                "Đây là keyword heuristic nên có thể có false positive (ví dụ `hình` "
                "trong “mô hình” không nhất thiết đòi hỏi nhìn ảnh, hoặc `note` xuất hiện "
                "trong ngữ cảnh khác) và false negative (cách diễn đạt không chứa keyword)."
            ),
            "",
            (
                "“Visual success” chỉ có nghĩa là câu trả lời không chứa failure phrase "
                "đã định nghĩa; nó không chứng minh câu trả lời đúng. Tương tự, citation "
                "không rỗng không chứng minh nguồn trích dẫn phù hợp."
            ),
            "",
            (
                "Ghép theo `turn_id` phụ thuộc tính đúng của ID do hệ thống nguồn cung cấp; "
                "fallback theo thời gian có thể sai nếu CSV không có timestamp đáng tin cậy "
                "hoặc hội thoại không luân phiên student/tutor."
            ),
            "",
            "## 7. Tái hiện",
            "",
            "Chạy từ thư mục gốc repository:",
            "",
            "```bash",
            "python scripts/analyze_chatlog.py \\",
            f"  --input {summary['input_file']} \\",
            "  --output-dir evidence",
            "```",
            "",
            (
                "Lần chạy sẽ ghi đè bốn artifact trong `evidence/` bằng kết quả tính "
                "lại từ CSV đầu vào; không có số liệu kết quả nào được hard-code."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def build_analysis_log(
    *,
    input_argument: str,
    rows_loaded: int,
    fieldnames: Sequence[str],
    detected: dict[str, str | None],
    summary: dict[str, Any],
    warnings: Sequence[str],
    skipped: dict[str, int],
    output_paths: Sequence[Path],
    pii_redactions: int,
) -> str:
    lines = [
        f"Input file: {input_argument}",
        f"Rows loaded: {rows_loaded}",
        "Detected columns:",
        "  Header: " + ", ".join(fieldnames),
    ]
    for semantic_name in COLUMN_ALIASES:
        lines.append(
            f"  {semantic_name}: {detected.get(semantic_name) or '(not detected)'}"
        )

    lines.extend(
        [
            f"QA pairs created: {summary['total_qa_pairs']}",
            "Pairing method: " + summary["pairing_method"],
            "Summary keyword rules: " + " | ".join(SUMMARY_KEYWORDS),
            "Visual keyword rules: " + " | ".join(VISUAL_KEYWORDS),
            (
                "Citation-empty rules: null | blank string | [] | {} | "
                + " | ".join(
                    sorted(CITATION_EMPTY_SENTINELS - {"", "[]", "{}", "null"})
                )
                + " | JSON containers containing only semantically empty values"
            ),
            "Failure keyword rules: " + " | ".join(FAILURE_KEYWORDS),
            "Counts:",
            f"  total_qa_pairs: {summary['total_qa_pairs']}",
            f"  citation_empty_pairs: {summary['citation_empty_pairs']}",
            f"  citation_nonempty_pairs: {summary['citation_nonempty_pairs']}",
            f"  summary_requests: {summary['summary_requests']}",
            f"  summary_without_citations: {summary['summary_without_citations']}",
            f"  summary_with_citations: {summary['summary_with_citations']}",
            f"  visual_requests: {summary['visual_requests']}",
            f"  visual_failures: {summary['visual_failures']}",
            f"  visual_successes: {summary['visual_successes']}",
            f"  visual_with_empty_citations: {summary['visual_with_empty_citations']}",
            f"  visual_with_citations: {summary['visual_with_citations']}",
            (
                "  visual_failures_without_citations: "
                f"{summary['visual_failures_without_citations']}"
            ),
            (
                "  visual_failures_with_citations: "
                f"{summary['visual_failures_with_citations']}"
            ),
            f"  summary_visual_overlap: {summary['summary_visual_overlap']}",
            f"  neither_summary_nor_visual: {summary['neither_summary_nor_visual']}",
            "  counts_by_summary_keyword: "
            + json.dumps(
                summary["counts_by_summary_keyword"], ensure_ascii=False, sort_keys=True
            ),
            "  counts_by_visual_keyword: "
            + json.dumps(
                summary["counts_by_visual_keyword"], ensure_ascii=False, sort_keys=True
            ),
            "  counts_by_failure_keyword: "
            + json.dumps(
                summary["counts_by_failure_keyword"], ensure_ascii=False, sort_keys=True
            ),
            f"  obvious_PII_redactions_in_examples: {pii_redactions}",
            "Warnings:",
        ]
    )
    if warnings:
        lines.extend(f"  - {warning}" for warning in warnings)
    else:
        lines.append("  - None")

    lines.append("Skipped rows:")
    all_skipped = {
        "malformed_rows": skipped.get("malformed_rows", 0),
        "missing_conversation_id": skipped.get("missing_conversation_id", 0),
        "missing_content": skipped.get("missing_content", 0),
        "unknown_role": skipped.get("unknown_role", 0),
        "unmatched_student_rows": summary["pairing_diagnostics"].get(
            "unmatched_student_rows", 0
        ),
        "unmatched_tutor_rows": summary["pairing_diagnostics"].get(
            "unmatched_tutor_rows", 0
        ),
    }
    lines.extend(f"  {name}: {count}" for name, count in all_skipped.items())

    lines.append("Output files:")
    lines.extend(f"  {path}" for path in output_paths)
    return "\n".join(lines) + "\n"


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_error_log(output_dir: Path, lines: Sequence[str]) -> None:
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        write_text(output_dir / "analysis_log.txt", "\n".join(lines) + "\n")
    except OSError:
        pass


def run(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    input_argument = args.input
    input_path = Path(input_argument)
    output_dir = Path(args.output_dir)
    partial_log = [f"Input file: {input_argument}"]

    try:
        if not input_path.is_file():
            raise AnalysisError(f"Không tìm thấy input CSV: {input_argument}")
        output_dir.mkdir(parents=True, exist_ok=True)

        with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames
            rows_loaded = sum(1 for _ in reader)
        if not fieldnames:
            raise AnalysisError("CSV không có header hoặc header rỗng.")
        partial_log.extend(
            [
                f"Rows loaded: {rows_loaded}",
                "Detected columns:",
                "  Header: " + ", ".join(fieldnames),
            ]
        )

        detected = detect_columns(fieldnames)
        for semantic_name in COLUMN_ALIASES:
            partial_log.append(
                f"  {semantic_name}: {detected.get(semantic_name) or '(not detected)'}"
            )

        messages, skipped, load_warnings, _ = load_messages(input_path, detected)
        pairs, pairing_diagnostics, pairing_warnings, pairing_method = create_qa_pairs(
            messages,
            has_turn_column=bool(detected["turn_id"]),
        )
        classified = classify_pairs(pairs)
        summary = build_summary(
            input_argument=input_argument,
            input_path=input_path,
            rows_loaded=rows_loaded,
            classified=classified,
            pairing_diagnostics=pairing_diagnostics,
            pairing_method=pairing_method,
            detected=detected,
            skipped=skipped,
        )

        records, example_warnings, pii_redactions = choose_examples(classified)
        examples_text, start_lines = render_examples_csv(records)
        evidence_text = build_evidence_markdown(summary, records, start_lines)

        summary_path = output_dir / "summary.json"
        examples_path = output_dir / "examples.csv"
        evidence_path = output_dir / "evidence.md"
        log_path = output_dir / "analysis_log.txt"
        output_paths = [summary_path, examples_path, log_path, evidence_path]

        write_text(
            summary_path,
            json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        )
        write_text(examples_path, examples_text)
        write_text(evidence_path, evidence_text)

        warnings = load_warnings + pairing_warnings + example_warnings
        log_text = build_analysis_log(
            input_argument=input_argument,
            rows_loaded=rows_loaded,
            fieldnames=fieldnames,
            detected=detected,
            summary=summary,
            warnings=warnings,
            skipped=skipped,
            output_paths=output_paths,
            pii_redactions=pii_redactions,
        )
        write_text(log_path, log_text)
        print(log_text, end="")
        return 0

    except (AnalysisError, csv.Error, OSError, UnicodeError) as error:
        partial_log.extend(
            [
                "Warnings:",
                f"  - ERROR: {error}",
                "Skipped rows:",
                "  Không xác định vì lần chạy thất bại.",
                "Output files:",
                f"  {output_dir / 'analysis_log.txt'}",
            ]
        )
        write_error_log(output_dir, partial_log)
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(run())
