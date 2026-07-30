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
    *   Có **134 lượt** mang ý định tóm tắt/ôn ý chính, trong đó **86/134 lượt** rơi vào nhóm thất bại/từ chối, **88/134 lượt** không có citation.
    *   Có **68 lượt** câu hỏi về sơ đồ, bảng, biểu đồ, vùng khoanh mà câu trả lời rơi vào nhóm thất bại/từ chối (vd: mã turn `T0399` hỏi giải thích biểu đồ bôi đỏ, `T0950` hỏi phần khoanh vùng nhưng tutor đều từ chối vì không nhìn thấy).

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
- **Mức prototype nhắm tới:** [x] Mock — UI tương tác mượt, data giả ở frontend, gọi AI thật ở nhân xử lý core.
- **Cấu trúc Agent (6 Tools):**
  1. `classify_intent(prompt, context)`: Xác định tóm tắt (summary), giải thích hình ảnh (explain_image) hay hỏi lại làm rõ (clarify).
  2. `get_knowledge_units(lesson_id, scope)`: Lấy các đơn vị kiến thức cần tóm tắt.
  3. `analyze_selected_region(full_image, crop_image, bbox, prompt)`: Phân tích vùng hình ảnh crop bằng VLM.
  4. `retrieve_lesson_evidence(lesson_id, query, image_id?)`: Tra cứu slide text và transcript liên quan.
  5. `verify_claims(claims, sources)`: Kiểm chứng các tuyên bố của mô hình với nguồn để tránh hallucination.
  6. `record_trace(...)`: Ghi log vết thực thi phục vụ debug/đánh giá.
- **Automation:** [x] conditional — AI tự trả lời khi chắc chắn nguồn và phạm vi; chủ động hỏi lại hoặc từ chối khi crop mờ, thiếu tiêu đề hoặc ngoài phạm vi khóa học để tránh hallucination (cost-of-error cao).

---

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8)
*(Chi tiết các kịch bản lỗi và hành vi mong muốn được định nghĩa trong file [golden_set.json](file:///c:/Users/HP/Desktop/hackathon/Batch03-K4-AI-Product-Hackathon/eval/golden_set.json) từ mã GS-09 đến GS-16)*
- **① Nguồn sự thật:** Học viên hỏi slide/chủ đề không tồn tại $\rightarrow$ AI từ chối suy đoán, báo lỗi hệ thống.
- **② Mơ hồ/Thiếu thông tin:** Học viên hỏi "sơ đồ này" nhưng crop ảnh trống hoặc không chọn vùng $\rightarrow$ AI yêu cầu bôi đen/crop lại vùng chọn rõ ràng hơn.
- **③ Ngoài phạm vi:** Học viên hỏi viết code ngoài khóa học hoặc hỏi deadlines $\rightarrow$ AI từ chối lịch sự, hướng dẫn xem Discord chính thức.
- **④ Đặc thù domain:** Học viên hỏi về các sơ đồ kỹ thuật của khóa học $\rightarrow$ AI giải thích chính xác theo thuật ngữ chuyên ngành bài học và trích dẫn mã đoạn `[Txx-NNN]`.

---

## §6. Bốn đường đi của trải nghiệm
- **Happy path:** Học viên chọn slide 15 $\rightarrow$ Khoanh vùng sơ đồ Self-Attention $\rightarrow$ AI trả về phiếu giải thích ngắn kèm citation `[T06-042]` chính xác.
- **Low-confidence (②):** Học viên crop vùng quá nhỏ/mờ $\rightarrow$ AI hiện cảnh báo: *"Vùng chọn của bạn quá nhỏ hoặc thiếu thông tin. Vui lòng quét rộng hơn bao gồm tiêu đề sơ đồ để tôi giải thích chính xác."*
- **Failure/không căn cứ (①):** Học viên hỏi slide 80 $\rightarrow$ AI phản hồi: *"Slide 80 không tồn tại trong bài giảng này (Day 01 chỉ có 60 trang). Vui lòng kiểm tra lại."*
- **Khi bị đòi ngoài phạm vi (③):** Học viên đòi viết game Flappy Bird $\rightarrow$ AI phản hồi: *"Yêu cầu này nằm ngoài phạm vi hỗ trợ học tập của tôi. Hãy đặt câu hỏi liên quan đến nội dung AI & LLM Foundation."*

---

## §7. Kiểm thử
- **Chiều chất lượng + định nghĩa kiểm chứng được:**
  1. *Accuracy & Citation:* Đạt khi câu trả lời đúng kiến thức bài học và bắt buộc có trích dẫn `[trang N]` hoặc `[Txx-NNN]`.
  2. *Scope & Fallback:* Đạt khi AI nhận diện được câu hỏi ngoài lề/mơ hồ và từ chối/hỏi lại theo đúng kịch bản, không đoán bừa.
  3. *Conciseness & Format:* Đạt khi định dạng tóm tắt dưới 5 gạch đầu dòng, ngôn ngữ dễ hiểu.
- **Golden set:** Gồm **20 cases** (10 thường gặp, 4 hiếm gặp, 6 trường hợp lỗi chỗ khó) được lưu trữ tại file [golden_set.json](file:///c:/Users/HP/Desktop/hackathon/Batch03-K4-AI-Product-Hackathon/eval/golden_set.json).
- **Quality Bar (Chốt trước 23:59 N1):** **Đạt khi >= 85% số cases trong Golden Set qua bộ lọc kiểm thử thành công.**
- **Kết quả các lượt chạy (Bảng cập nhật):**
  * *Lượt chạy 1 (Baseline - 2026-07-30):* **Đạt 12/20 (60%)** $\rightarrow$ Chưa đạt Quality Bar. (Chi tiết tại file [evaluation_run_1.md](file:///c:/Users/HP/Desktop/hackathon/Batch03-K4-AI-Product-Hackathon/eval/evaluation_run_1.md)).

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
