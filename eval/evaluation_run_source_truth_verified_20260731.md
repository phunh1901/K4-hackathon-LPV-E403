# Evaluation run_source_truth_verified_20260731

- Thời điểm UTC: 2026-07-31T04:51:15.552690+00:00
- Pipeline: `codebase/agent_core.py` (cùng pipeline với UI)
- Pre-score theo khái niệm: **1/1 = 100%**
- Pre-score khớp đúng nhãn chữ: **1/1 = 100%**

### Tách theo bên ra quyết định

- **Case do AI quyết định: 1/1 = 100%** — đây là con số phản ánh năng lực thật của model.
- Case do rule quyết định: 0/0 — rule chỉ xử lý đầu vào tất định (trang không tồn tại, ảnh thiếu/quá nhỏ, hoặc yêu cầu tóm tắt hoàn toàn chưa rõ); các case này pass theo thiết kế nên không tính là thành tích của AI.
- Citation đối chiếu được với text thật của trang: **0/0**

- Alias semantic được khai báo cố định trong `eval/run_eval.py`; không thay đổi golden set sau khi xem output.
- Quality bar đã chốt trong spec: **>= 85%**, đồng thời không bịa citation ở case nguồn-sự-thật.
- Lưu ý: đây là pre-score tái lập. Hai thành viên phải chấm độc lập ít nhất 5 case khó trước khi dùng % làm kết quả CP3 cuối.

## Phân bố case

hard_source_of_truth: 1

## Kết quả

| Case | Category | Quyết định bởi | Kind | Pass | Citation đối chiếu | Lý do máy |
|---|---|:---:|---|:---:|:---:|---|
| GS-10 | hard_source_of_truth | AI | clarify | ĐẠT | — | đạt pre-score |
