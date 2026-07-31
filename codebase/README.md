# VLearn Study Focus — prototype CP3

Prototype dùng **PDF thật**, backend AI cùng origin, trace trong `eval/`, và chỉ bật mock khi URL có `?mock=1`.

## Chạy local

```bash
python3 -m pip install -r codebase/requirements.txt
cp .env.example .env
# điền key ở .env, không commit file này
python3 codebase/server.py
```

Mở `http://127.0.0.1:8000/codebase/`. Không double-click `index.html`, vì UI cần `/api/agent`.

## Cấu hình model

- Text/bôi đen/tóm tắt: `DEEPSEEK_API_KEY` (hoặc `AI_API_KEY`), `AI_MODEL=deepseek-v4-flash`.
- Chụp vùng: `OPENROUTER_API_KEY`, `VISION_BASE_URL=https://openrouter.ai/api/v1`, `VISION_MODEL=google/gemma-4-31b-it`. Có thể dùng `VISION_API_KEY` để override key theo provider khác.
- API key chỉ được đọc phía server. UI không lưu key vào HTML/localStorage.

## Những flow đã nối

1. Mở hai PDF Day 01/Day 02; mỗi file thật có 29 trang.
2. Nhập câu hỏi trong Tutor hoặc bấm **Tóm tắt toàn bộ tài liệu**.
3. Bôi đen text → **Hỏi AI** → gửi nguyên văn đoạn chọn + đúng trang.
4. **Chụp vùng** → crop pixel thật từ canvas PDF → gửi ảnh + text layer + bbox.
5. Backend phân loại intent; yêu cầu làm rõ nếu một lệnh tóm tắt chưa có mục đích/độ dài; nếu đã rõ thì đưa toàn bộ PDF vào model.
6. Câu hỏi hiểu được trang hiện tại, `slide 3`, đoạn bôi đen, vùng ảnh, thuật ngữ ở bất kỳ trang nào và tham chiếu từ các lượt chat trước.
7. Q&A chỉ dùng toàn bộ text của PDF đang mở làm nguồn có thể trích trang; nội dung ngoài khóa học bị từ chối, chủ đề thuộc khóa nhưng thiếu trong PDF được hỏi lại.
8. Browser giữ cửa sổ hội thoại có giới hạn và gửi kèm mỗi lượt; backend stream token thật qua `POST /api/agent/stream`, sau đó trả kết quả đã kiểm citation.
9. Trace ghi intent, tham chiếu đã resolve, số lượt history, model, request ID, latency, token usage và grounding.
10. Nếu backend/model lỗi, UI giữ câu hỏi và hiện lỗi; không tự rơi về mock.

Text model DeepSeek V4 được gọi ở non-thinking mode cho tác vụ grounded Q&A/tóm tắt. Thinking mode mặc định có thể dùng hết output budget trước khi sinh `content`; tắt thinking giúp summary 29 trang trả kết quả trực tiếp và vẫn giữ full-file context.

## Mock và giới hạn còn lại

- `?mock=1` là chế độ demo có chủ đích; badge ghi rõ `MOCK CÓ CHỦ ĐÍCH`.
- Không có vision credential thì crop ảnh sẽ dừng với hướng dẫn cấu hình, không giả vờ đã nhìn ảnh.
- Ghi chú/annotation chỉ ở bộ nhớ trình duyệt và mất khi refresh.
- Feedback 👍/👎 mới có phản hồi UI, chưa lưu backend.
- PDF.js hiện tải từ CDN, nên lần đầu chạy cần mạng.

## Bằng chứng CP3

- Golden set: `eval/golden_set.json` — 20 case (8 thường, 8 case khó, 4 hiếm), 15 case ghi nguồn/adaptation từ chatlog.
- Output AI thật: `eval/actual_outputs_run_12_final.json`.
- Trace có request ID/model/token usage: `eval/agent_traces_run_12_final.jsonl` — đủ 20/20 case; bốn call ảnh dùng `google/gemma-4-31b-it`.
- Bảng kết quả: `eval/evaluation_run_12_final.md` — pre-score khái niệm 19/20 (95%), exact-label 18/20 (90%), đạt bar máy 85%.
- Regression cho flow context/streaming hiện tại: `eval/evaluation_run_agent_flow_verified_20260731.md` — 22/24 (92%), AI-only 19/21 (90%), 0 API/JSON error, 48/53 source excerpt đối chiếu được.
- Invariant nguồn-sự-thật cuối cùng: `eval/evaluation_run_source_truth_verified_20260731.md` — case hỏi chủ đề không có trong PDF trả `clarify`, không gắn citation từ trang không liên quan.
- Run 1 cũ được giữ và đánh dấu không hợp lệ vì thực chất là mock.

## Chạy eval

```bash
python3 eval/run_eval.py --run-id run_next
python3 -m unittest discover -s codebase -p 'test_*.py' -v
```

Hai thành viên cần chấm độc lập ít nhất 5 case khó trước khi chốt phần trăm cuối; pre-score không thay thế bước này.
