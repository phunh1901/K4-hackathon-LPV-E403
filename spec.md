# AI SPEC — VLEARN STUDY FOCUS · Nhóm [XX] · Zone [X]

Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

---

## §1. User & Job
- **Job executor + workflow:** Học viên đang tự đọc hoặc ôn tập một buổi học trên hệ thống VLearn.
- **Core JTBD:** Hiểu nhanh đúng phần nội dung kiến thức đang cần học trong tài liệu slide/transcript bài giảng mà không phải rời trang tài liệu hay tìm kiếm thủ công mất thời gian.
- **Problem statement:** Học viên muốn ôn tập nhanh nhưng slide quá dài (30-50 trang) gây mất nhiều thời gian đọc hết, đồng thời khó hỏi AI Tutor về các sơ đồ, đoạn code phức tạp trên slide do không thể chỉ định vùng chọn, dẫn đến mất thời gian mô tả thủ công hoặc AI hiểu sai ngữ cảnh.
- **Evidence (chuẩn B - mining dữ liệu):**
  - Mining trên **1.261 cặp hỏi-đáp** trong chatlog VLearn thật:
    *   **582/1.261 câu trả lời** của tutor không có citation trong field `citations`.
    *   Theo regex được công bố trong `eval/audit_evidence.py`, có **144 lượt** mang ý định tóm tắt; **69/144** có ngôn ngữ từ chối/không tìm thấy và **90/144** không citation.
    *   Có **14 lượt** nhắc rõ vùng ảnh (`khoanh|bôi đỏ|vùng chọn|crop`); **9/14** bị từ chối/không tìm thấy và **9/14** không citation (ví dụ `T0399`, `T0950`).
  - Bảng đếm, regex và 5 ví dụ có thể tái lập tại `eval/evidence_audit.md`. Các con số 134/86/88 và 68 trong bản cũ đã bị loại vì không khớp phép đếm có thể kiểm tra.

---

## §2. Impact & quyết định chọn
- **Bảng impact 3 ứng viên:**
  1. *Tính năng tóm tắt slide theo yêu cầu:* Tác động đến 100% học viên ôn bài, tần suất 2-3 lần/tuần, tiết kiệm 15 phút mỗi lần đọc slide dài. Khả thi: Cao.
  2. *Tính năng hỏi đáp theo vùng chọn (bôi đen/crop sơ đồ):* Tác động đến 60% học viên gặp hình ảnh/code khó, tần suất 4-5 lần/tuần, tiết kiệm 3 phút gõ mô tả. Khả thi: Vừa.
  3. *Tính năng tự động sinh quiz ôn tập cuối buổi:* Tác động đến 40% học viên tự luyện, tần suất 1 lần/buổi. Khả thi: Vừa.
- **Ứng viên ĐÃ LOẠI + vì sao:** Ứng viên 3 (Tự sinh quiz) bị loại vì khó kiểm soát chất lượng câu hỏi trong thời gian ngắn của hackathon (cost-of-error cao khi sinh quiz sai kiến thức).
- **Ứng viên CHỌN + vì sao:** Chọn tích hợp ứng viên 1 và 2 làm một lát cắt duy nhất: Giải quyết triệt để vấn đề thời gian đọc slide dài và lỗi hiểu sai ngữ cảnh sơ đồ của AI Tutor hiện tại.

---

## §3. Giải pháp tương tự đã nghiên cứu
- **NotebookLM:** Flow tải tài liệu lên để chat + tự sinh hướng dẫn học. *Đáng học:* Citation đính kèm trực tiếp cạnh câu trả lời rất trực quan. *Đáng né:* Tóm tắt quá dài và không bám sát văn phong giảng bài của khóa học.
- **ChatGPT Study Mode:** Hỗ trợ khoanh vùng/chụp ảnh để hỏi. *Đáng học:* Khả năng OCR hình ảnh và code rất tốt. *Đáng né:* Giao diện chat chung, người dùng phải tự tải ảnh lên thủ công, không tích hợp sẵn trong trang đọc slide.

---

## §4. Thiết kế
- **Lát cắt MỘT CÂU:** Với học viên đang ôn lại một buổi học trên VLearn, khi họ chọn toàn bài hoặc khoanh một vùng slide, hệ thống quyết định phạm vi và loại bằng chứng cần dùng để tạo một phiếu học tập ngắn, đúng mục tiêu và có trích dẫn cho từng ý.
- **Non-goals (3 thứ KHÔNG build):**
  1. Không build hệ thống chấm điểm bài tập tự động cho học viên.
  2. Không tích hợp tính năng chat voice trực tiếp với AI.
  3. Không dịch slide sang các ngôn ngữ khác ngoài Tiếng Việt và Tiếng Anh của khóa học.
- **Mức prototype hiện tại:** [x] Functional prototype — PDF, bôi đen, crop, backend, AI text và vision đều chạy thật. Vision dùng OpenRouter `google/gemma-4-31b-it`; mock chỉ bật có chủ đích bằng `?mock=1`.
- **Cấu trúc Agent đã triển khai:**
  1. `classify(payload)` + `summary_preferences(...)`: Xác định summary/question và kiểm tra mục đích + ngân sách thời gian đọc trước khi tóm tắt.
  2. `resolve_reference(...)`: Hiểu trang hiện tại, `slide 3`, đoạn bôi đen, vùng ảnh và tham chiếu từ lịch sử hội thoại.
  3. `document_pages(...)` + `gather_evidence(...)`: Đọc toàn bộ PDF thật cho cả summary và Q&A; chỉ PDF có số trang mới được dùng làm nguồn citation.
  4. `_build_messages(...)` + `_call_model(...)`: Gửi cửa sổ hội thoại có giới hạn, gọi text/VLM và stream token thật qua backend.
  5. `_normalize_answer(...)`: Loại page citation không hợp lệ, đối chiếu source excerpt và chặn output tự nhận thiếu evidence nhưng vẫn gắn nhãn `answered`.
  6. `_trace(...)`: Ghi intent, reference đã resolve, số lượt history, model, request ID, latency và token usage vào JSONL.
- **Automation:** [x] conditional — AI tự trả lời khi chắc chắn nguồn và phạm vi; chủ động hỏi lại hoặc từ chối khi crop mờ, thiếu tiêu đề hoặc ngoài phạm vi khóa học để tránh hallucination (cost-of-error cao).

---

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8)
*(Chi tiết các kịch bản lỗi và hành vi mong muốn nằm trong `eval/golden_set.json`, mã GS-09 đến GS-16.)*
- **① Nguồn sự thật:** Học viên hỏi slide/chủ đề không tồn tại $\rightarrow$ AI từ chối suy đoán, báo lỗi hệ thống.
- **② Mơ hồ/Thiếu thông tin:** Học viên hỏi "sơ đồ này" nhưng crop ảnh trống hoặc không chọn vùng $\rightarrow$ AI yêu cầu bôi đen/crop lại vùng chọn rõ ràng hơn.
- **③ Ngoài phạm vi:** Học viên hỏi viết code ngoài khóa học hoặc hỏi deadlines $\rightarrow$ AI từ chối lịch sự, hướng dẫn xem Discord chính thức.
- **④ Đặc thù domain:** Học viên hỏi về các sơ đồ kỹ thuật của khóa học $\rightarrow$ AI giải thích chính xác theo thuật ngữ chuyên ngành bài học và trích dẫn trang PDF `[trang N]`.

---

## §6. Bốn đường đi của trải nghiệm
- **Happy path:** Học viên bôi đen nội dung slide 15 Day 01 $\rightarrow$ hỏi về Attention $\rightarrow$ AI trả giải thích ngắn kèm citation `[trang 15]`.
- **Low-confidence (②):** Học viên crop vùng quá nhỏ/mờ $\rightarrow$ AI hiện cảnh báo: *"Vùng chọn của bạn quá nhỏ hoặc thiếu thông tin. Vui lòng quét rộng hơn bao gồm tiêu đề sơ đồ để tôi giải thích chính xác."*
- **Failure/không căn cứ (①):** Học viên hỏi slide 80 $\rightarrow$ AI phản hồi: *"Trang 80 không tồn tại; tài liệu này có 29 trang."*
- **Khi bị đòi ngoài phạm vi (③):** Học viên đòi viết game Flappy Bird $\rightarrow$ AI phản hồi: *"Yêu cầu này nằm ngoài phạm vi hỗ trợ học tập của tôi. Hãy đặt câu hỏi liên quan đến nội dung AI & LLM Foundation."*

---

## §7. Kiểm thử
- **Chiều chất lượng + định nghĩa kiểm chứng được:**
  1. *Accuracy & Citation:* Đạt khi câu trả lời đúng kiến thức bài học và mọi ý kiến thức bắt buộc có trích dẫn `[trang N]`.
  2. *Scope & Fallback:* Đạt khi AI nhận diện được câu hỏi ngoài lề/mơ hồ và từ chối/hỏi lại theo đúng kịch bản, không đoán bừa.
  3. *Conciseness & Format:* Đạt khi định dạng tóm tắt dưới 5 gạch đầu dòng, ngôn ngữ dễ hiểu.
- **Golden set:** **24 case** gồm 8 thường, 12 case khó và 4 hiếm; toàn bộ ghi rõ nguồn/adaptation. Bốn fixture ảnh là pixel render từ PDF thật. File: `eval/golden_set.json`.
  * GS-21..24 bổ sung sau khi đo được rằng bộ phân loại cũ chỉ bắt đúng câu đã chuẩn bị: ba câu logistics diễn đạt khác (0/4 nhận diện đúng trước khi sửa) và một câu prompt injection để nghiệm thu guardrail mới.
- **Ai ra quyết định — khai báo rõ để không thổi phồng năng lực AI:**
  * **Rule (có chủ đích):** chỉ xử lý đầu vào tất định — trang không tồn tại, ảnh thiếu/quá nhỏ, hoặc lệnh tóm tắt hoàn toàn chưa rõ mục đích/độ dài.
  * **AI:** quyết định scope cho mọi câu hỏi còn lại, gồm logistics, nhờ làm việc ngoài môn và chủ đề thuộc khóa học nhưng không có trong PDF. Không dùng regex từ khóa để làm đẹp golden set.
  * Bảng kết quả tách hai cột nên đọc được riêng điểm của model.
- **Quality Bar (Chốt trước 23:59 N1):** **Đạt khi >= 85% số cases trong Golden Set qua bộ lọc kiểm thử thành công.**
- **Kết quả các lượt chạy (Bảng cập nhật):**
  * *Lượt chạy 1:* **Không hợp lệ** — 18/20 output ghi `[MOCK]` nhưng báo cáo cũ tự nhận Gemini và 12/20. Giữ tại `eval/evaluation_run_1.md` để audit.
  * *Lượt chạy 2 (AI thật - 2026-07-30):* **pre-score 16/20 (80%)** $\rightarrow$ Chưa đạt Quality Bar. Cả 4 case fail là image/vision do chưa cấu hình vision credential. Trace 16 case còn lại có model/request ID/token usage tại `eval/agent_traces_run_2.jsonl`. Cần người thứ hai chấm độc lập 5 case khó trước khi chốt % cuối.
  * *Lượt chạy 12 (AI thật, text + Gemma 4 vision - 2026-07-30):* **pre-score khái niệm 19/20 (95%)**, exact-label 18/20 (90%) $\rightarrow$ **đạt bar máy 85%**. Đủ 20 output/20 trace, không có API error, 4 case gọi VLM có model `google/gemma-4-31b-it` và request ID. Case fail duy nhất trả lời đúng nội dung nhưng dùng citation `[tr.23]`, trong khi runner chỉ nhận `[trang 23]`; vẫn giữ FAIL để tránh nới rubric sau khi xem output.
  * *Lượt chạy 13 (sau khi sửa citation, chuyển refuse ngoài-logistics sang AI, thêm BM25 + transcript, 24 case):* **21/24 = 88% tổng · AI-only 15/18 = 83%** $\rightarrow$ **AI-only chưa đạt bar 85%**. Citation đối chiếu được với text thật của trang: **39/40 = 98%** (trước là 58%). Fail: GS-07, GS-18 (thiếu khái niệm bắt buộc), GS-14 (trả `clarify` thay vì `refuse`).
  * *Lượt chạy 14 (hạ `temperature` 0.1 → 0 vì Run 13 cho thấy cùng một câu lúc `refuse` lúc `clarify`; đổi vì tính tái lập, không phải để tăng điểm):* **20/24 = 83% · AI-only 14/18 = 78%** $\rightarrow$ **kém hơn Run 13, ghi nhận nguyên trạng, không quay lại 0.1 để lấy số đẹp**. Xuất hiện thêm một case `error` do model dựng bảng markdown làm vỡ JSON.
  * *Lượt chạy 15 (sau khi sửa lỗi vỡ JSON — cấm dấu ngoặc kép trong chuỗi + 2 lần tự sửa):* **23/24 = 96% tổng · AI-only 17/18 = 94%** $\rightarrow$ **cả hai đều đạt bar 85%**. Citation đối chiếu được **44/52 = 85%**. Case fail duy nhất là **GS-14**: model trả **đúng** `refuse`, nhưng trượt `required_terms: ["ngoài phạm vi"]` — từ khoá này viết theo đúng chuỗi cứng của rule cũ, không phải tiêu chí chất lượng. **Cố ý giữ FAIL**; sửa golden set sau khi đã nhìn output là nới rubric, việc này để người review quyết định.
  * *Run agent-flow verified (2026-07-31, full PDF context + history + streaming):* **22/24 = 92% tổng · AI-only 19/21 = 90%**, 0 API/JSON error, citation excerpt đối chiếu được **48/53 = 91%**. Sau run, invariant nguồn-sự-thật được siết để output tự nhận topic không có trong file luôn chuyển sang `clarify`; case GS-10 chạy lại **1/1 pass** tại `eval/evaluation_run_source_truth_verified_20260731.md`. Không sửa golden set.

---

## §8. Phân công & kế hoạch
- **Phân công thành viên:**
  * **Long:** Spec, Evidence Report, API Tích hợp luồng Fallback & Orchestration.
  * **Phú:** Summary pipeline & Prompt Engineering cho luồng tóm tắt.
  * **Việt:** Giao diện crop/bôi đen slide, Point-and-Explain Vision pipeline.
- **Willing users:** Chiến, Phúc, Kiên.
- **Kế hoạch validation CP5:** Phỏng vấn 10 phút/người, quan sát thao tác dùng thử, ghi nhận quote phản hồi về mức độ tin tưởng citation và độ tiện dụng của tính năng khoanh vùng.

---

## §9. Changelog
| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 2026-07-30 | Khởi tạo tài liệu Spec | Thiết lập cấu trúc sơ bộ và tích hợp kết quả Run 1 của Golden Set. |
| 2026-07-30 | Audit CP3, vô hiệu Run 1, xây lại golden set và backend | Run 1 là mock; PDF/golden cũ sai số trang; API key bị hardcode; app dừng do thiếu HTML. |
| 2026-07-30 | Chạy Run 2 bằng AI thật | Đạt 16/20 pre-score; chưa có vision credential nên 4 case ảnh fail. |
| 2026-07-30 | Cấu hình OpenRouter Gemma 4 31B và chạy Run 12 | 19/20 pre-score khái niệm; 20/20 trace; đạt quality bar máy, còn chấm độc lập và manual QA. |
