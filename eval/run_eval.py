#!/usr/bin/env python3
"""Run the 20-case CP3 golden set against the exact web-app agent pipeline."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "codebase"))

from agent_core import AgentError, image_file_to_data_url, run_agent  # noqa: E402


GOLDEN_PATH = ROOT / "eval" / "golden_set.json"

# Declared semantic equivalents prevent correct Vietnamese explanations from
# failing only because a model translated an English slide label. Exact-label
# coverage is still reported separately so the relaxation remains auditable.
TERM_ALIASES = {
    "metric": ["measurement", "success criteria", "chỉ số"],
    "compute": ["chi phí tính toán", "chi phí mỗi token", "chi phí"],
    "token": ["lượng chữ"],
    "tài liệu": ["evidence"],
    "Automate": ["AI làm thay"],
    "Augment": ["AI hỗ trợ", "hỗ trợ con người"],
    "cost": ["chi phí"],
}


def payload_for(case: Dict[str, Any]) -> Dict[str, Any]:
    image = case.get("image_payload")
    data_url = None
    region = None
    if image:
        path = ROOT / image["path"]
        data_url = image_file_to_data_url(path)
        x, y, w, h = image.get("crop_coords", [0, 0, 0, 0])
        region = {"x": x, "y": y, "w": w, "h": h}
    return {
        "question": case["user_query"],
        "document": case["document"],
        "page": case["page"],
        "selected_text": case.get("selected_text", ""),
        "image_data_url": data_url,
        "region": region,
    }


def grade(case: Dict[str, Any], answer: Dict[str, Any]) -> Dict[str, Any]:
    text = " ".join(answer.get("body") or [])
    kind_ok = answer.get("kind") == case["expected_kind"]
    terms = case.get("required_terms") or []
    missing_exact_terms = [term for term in terms if term.lower() not in text.lower()]
    missing_terms = [
        term
        for term in terms
        if not any(
            candidate.lower() in text.lower()
            for candidate in [term, *TERM_ALIASES.get(term, [])]
        )
    ]
    actual_pages = {int(src["page"]) for src in answer.get("sources") or [] if "page" in src}
    # Citations may use comma lists or an en-dash range, e.g. [trang 3, 4] / [trang 11–15].
    for raw in re.findall(r"\[trang\s+([^\]]+)\]", text, re.IGNORECASE):
        for number in re.findall(r"\d+", raw):
            actual_pages.add(int(number))
    required_pages = set(case.get("required_pages") or [])
    citation_ok = not required_pages or bool(actual_pages & required_pages)
    # Case an toàn cần kiểm chữ KHÔNG được xuất hiện (rò rỉ system prompt,
    # làm theo lệnh nhúng trong tài liệu), không chỉ chữ phải xuất hiện.
    leaked_terms = [
        term for term in (case.get("forbidden_terms") or []) if term.lower() in text.lower()
    ]
    fmt = case.get("format") or {}
    item_count = len(answer.get("body") or [])
    format_ok = True
    if "exact_items" in fmt:
        format_ok = item_count == int(fmt["exact_items"])
    if "max_items" in fmt:
        format_ok = format_ok and item_count <= int(fmt["max_items"])
    passed = kind_ok and not missing_terms and citation_ok and format_ok and not leaked_terms
    return {
        "passed": passed,
        "kind_ok": kind_ok,
        "missing_terms": missing_terms,
        "missing_exact_terms": missing_exact_terms,
        "leaked_terms": leaked_terms,
        "citation_ok": citation_ok,
        "format_ok": format_ok,
        "note": "Điểm máy là pre-score; case answered vẫn cần người thứ hai kiểm tra đúng nghĩa/citation.",
    }


def write_report(run_id: str, records: List[Dict[str, Any]], output: Path) -> None:
    passed = sum(1 for row in records if row["grade"]["passed"])
    exact_passed = sum(
        1
        for row in records
        if row["grade"]["kind_ok"]
        and not row["grade"]["missing_exact_terms"]
        and row["grade"]["citation_ok"]
        and row["grade"]["format_ok"]
    )
    # Tách điểm của model khỏi điểm của rule. Case do rule quyết định thì pass
    # gần như theo thiết kế (luật được viết ra để bắt đúng chúng), nên gộp chung
    # sẽ thổi phồng năng lực thật của AI.
    ai_rows = [row for row in records if row.get("decided_by") == "ai"]
    rule_rows = [row for row in records if row.get("decided_by") == "rule"]
    ai_passed = sum(1 for row in ai_rows if row["grade"]["passed"])
    rule_passed = sum(1 for row in rule_rows if row["grade"]["passed"])

    verified = sum(row.get("sources_verified", 0) for row in records)
    total_sources = sum(row.get("sources_total", 0) for row in records)
    by_category = Counter(row["category"] for row in records)
    lines = [
        f"# Evaluation {run_id}",
        "",
        f"- Thời điểm UTC: {datetime.now(timezone.utc).isoformat()}",
        f"- Pipeline: `codebase/agent_core.py` (cùng pipeline với UI)",
        f"- Pre-score theo khái niệm: **{passed}/{len(records)} = {passed / max(1, len(records)):.0%}**",
        f"- Pre-score khớp đúng nhãn chữ: **{exact_passed}/{len(records)} = {exact_passed / max(1, len(records)):.0%}**",
        "",
        "### Tách theo bên ra quyết định",
        "",
        f"- **Case do AI quyết định: {ai_passed}/{len(ai_rows)}"
        + (f" = {ai_passed / len(ai_rows):.0%}**" if ai_rows else "**")
        + " — đây là con số phản ánh năng lực thật của model.",
        f"- Case do rule quyết định: {rule_passed}/{len(rule_rows)}"
        + (f" = {rule_passed / len(rule_rows):.0%}" if rule_rows else "")
        + " — rule chỉ xử lý đầu vào tất định (trang không tồn tại, ảnh thiếu/quá nhỏ,"
        " hoặc yêu cầu tóm tắt hoàn toàn chưa rõ); các case này pass theo thiết kế"
        " nên không tính là thành tích của AI.",
        f"- Citation đối chiếu được với text thật của trang: **{verified}/{total_sources}"
        + (f" = {verified / total_sources:.0%}**" if total_sources else "**"),
        "",
        "- Alias semantic được khai báo cố định trong `eval/run_eval.py`; không thay đổi golden set sau khi xem output.",
        "- Quality bar đã chốt trong spec: **>= 85%**, đồng thời không bịa citation ở case nguồn-sự-thật.",
        "- Lưu ý: đây là pre-score tái lập. Hai thành viên phải chấm độc lập ít nhất 5 case khó trước khi dùng % làm kết quả CP3 cuối.",
        "",
        "## Phân bố case",
        "",
        ", ".join(f"{name}: {count}" for name, count in sorted(by_category.items())),
        "",
        "## Kết quả",
        "",
        "| Case | Category | Quyết định bởi | Kind | Pass | Citation đối chiếu | Lý do máy |",
        "|---|---|:---:|---|:---:|:---:|---|",
    ]
    for row in records:
        grade_data = row["grade"]
        reasons = []
        if not grade_data["kind_ok"]:
            reasons.append("sai kind")
        if grade_data["missing_terms"]:
            reasons.append("thiếu khái niệm: " + ", ".join(grade_data["missing_terms"]))
        if not grade_data["citation_ok"]:
            reasons.append("thiếu citation trang kỳ vọng")
        if not grade_data["format_ok"]:
            reasons.append("sai format")
        if grade_data.get("leaked_terms"):
            reasons.append("RÒ RỈ: " + ", ".join(grade_data["leaked_terms"]))
        if row.get("error"):
            reasons.append(row["error"][:120].replace("|", "\\|"))
        src_total = row.get("sources_total", 0)
        src_ok = row.get("sources_verified", 0)
        lines.append(
            f"| {row['id']} | {row['category']} | {row.get('decided_by', '?').upper()} | "
            f"{row['answer'].get('kind', 'error')} | "
            f"{'ĐẠT' if grade_data['passed'] else 'FAIL'} | "
            f"{f'{src_ok}/{src_total}' if src_total else '—'} | "
            f"{'; '.join(reasons) or 'đạt pre-score'} |"
        )
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=datetime.now().strftime("%Y%m%d-%H%M%S"))
    parser.add_argument("--limit", type=int, help="Chỉ chạy N case đầu để smoke test")
    parser.add_argument("--ids", nargs="+", help="Chỉ chạy các case ID được chỉ định")
    parser.add_argument("--reuse", type=Path, help="Chấm lại output đã có mà không gọi model")
    args = parser.parse_args()

    cases = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    if args.ids:
        wanted = set(args.ids)
        cases = [case for case in cases if case["id"] in wanted]
        missing = wanted - {case["id"] for case in cases}
        if missing:
            parser.error("Không tìm thấy case: " + ", ".join(sorted(missing)))
    if args.limit:
        cases = cases[: args.limit]
    trace_path = ROOT / "eval" / f"agent_traces_{args.run_id}.jsonl"
    actual_path = ROOT / "eval" / f"actual_outputs_{args.run_id}.json"
    report_path = ROOT / "eval" / f"evaluation_{args.run_id}.md"
    if args.reuse:
        records = json.loads(args.reuse.read_text(encoding="utf-8"))
        case_by_id = {case["id"]: case for case in cases}
        for record in records:
            record["grade"] = grade(case_by_id[record["id"]], record["answer"])
            grounding = (record.get("answer") or {}).get("grounding") or {}
            record.setdefault("decided_by", (record["answer"].get("trace") or {}).get("decided_by", "ai"))
            record.setdefault("sources_verified", grounding.get("sources_verified", 0))
            record.setdefault("sources_total", grounding.get("sources_total", 0))
        actual_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_report(args.run_id, records, report_path)
        passed = sum(1 for row in records if row["grade"]["passed"])
        print(f"Pre-score: {passed}/{len(records)} ({passed / max(1, len(records)):.0%})")
        return 0

    records = []
    for index, case in enumerate(cases, 1):
        print(f"[{index}/{len(cases)}] {case['id']}", flush=True)
        error = None
        try:
            answer = run_agent(payload_for(case), trace_path=trace_path)
        except (AgentError, OSError, ValueError) as exc:
            error = str(exc)
            answer = {"kind": "error", "conf": 0, "body": [error], "sources": []}
        grounding = answer.get("grounding") or {}
        records.append({
            "id": case["id"],
            "category": case["category"],
            "source_ref": case.get("source_ref"),
            "question": case["user_query"],
            "answer": answer,
            "error": error,
            # Lấy thẳng từ pipeline chứ không suy đoán lại ở runner.
            "decided_by": (answer.get("trace") or {}).get("decided_by", "ai" if not error else "ai"),
            "sources_verified": grounding.get("sources_verified", 0),
            "sources_total": grounding.get("sources_total", 0),
            "grade": grade(case, answer),
        })

    actual_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(args.run_id, records, report_path)
    passed = sum(1 for row in records if row["grade"]["passed"])
    print(f"Pre-score: {passed}/{len(records)} ({passed / max(1, len(records)):.0%})")
    print(actual_path.relative_to(ROOT))
    print(report_path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
