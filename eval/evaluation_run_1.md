# Báo Cáo Đánh Giá Chất Lượng - Lượt Chạy 1 (Run 1)

*   **Thời điểm thực hiện:** 2026-07-30
*   **Người đánh giá:** Long (Product & Integration) & Phú (Summary) & Việt (Vision)
*   **Mô hình thử nghiệm:** Gemini 1.5 Flash (Baseline Prompt - Chưa có Ràng buộc nâng cao)
*   **Bộ kiểm thử:** Golden Set 20 cases (`eval/golden_set.json`)

---

## 1. Định Nghĩa Các Chiều Chất Lượng (Quality Dimensions)

Để chấm điểm trung thực cho từng câu trả lời, nhóm quy định 3 chiều chất lượng (Pass/Fail):

1.  **Độ chính xác & Trích dẫn (Accuracy & Citation):**
    *   *Đạt:* Nội dung không bịa đặt, có dẫn chứng cụ thể bằng số trang `[trang N]` hoặc mã đoạn `[Txx-NNN]` khớp với tài liệu giảng dạy.
    *   *Không đạt:* Bịa thông tin hoặc trích dẫn sai số trang/mã đoạn.
2.  **Khả năng xử lý chỗ khó & Hạn chế phạm vi (Scope & Fallback):**
    *   *Đạt:* Nhận diện được câu hỏi ngoài phạm vi, mơ hồ hoặc thiếu tài liệu để từ chối khéo léo hoặc hỏi lại rõ ràng.
    *   *Không đạt:* Trả lời liều, suy đoán bừa bãi khi thiếu thông tin hoặc làm hộ các tác vụ ngoài phạm vi (như viết code game).
3.  **Độ ngắn gọn & Định dạng (Conciseness & Format):**
    *   *Đạt:* Trả lời đúng cỡ, tóm tắt cô đọng, định dạng chuẩn yêu cầu (ví dụ: gạch đầu dòng ngắn).
    *   *Không đạt:* Trả lời tràn lan, lặp ý.

---

## 2. Bảng Kết Quả Chi Tiết Lượt Chạy 1 (Baseline)

*Tỷ lệ đạt mục tiêu (Quality Bar):* **Đặt Bar ban đầu là >= 85%**.
*Kết quả Lượt chạy 1:* **Đạt 12/20 cases (Tỷ lệ: 60%)** $\rightarrow$ **CHƯA ĐẠT Quality Bar**.

| Mã Case | Loại Input | Phân loại | Kết quả (Đạt/Fail) | Chi tiết lỗi / Lý do thất bại |
| :--- | :--- | :--- | :---: | :--- |
| **GS-01** | summary | normal | **ĐẠT** | Tóm tắt đúng ý chính bài Day 01, có cite trang 6 và 28. |
| **GS-02** | summary | normal | **ĐẠT** | Tóm tắt tốt bài Day 02, có trích dẫn đúng. |
| **GS-03** | point-and-explain | normal | **ĐẠT** | Nhận diện được code self-attention và giải thích tốt. |
| **GS-04** | point-and-explain | normal | **ĐẠT** | Giải thích đúng sơ đồ Reasoning, Action, Memory. |
| **GS-05** | summary | normal | **FAIL** | *Lỗi Citation:* Trả lời đúng lý thuyết nhưng **thiếu hoàn toàn trích dẫn** số trang slide. |
| **GS-06** | point-and-explain | normal | **ĐẠT** | Giải thích chính xác kiến trúc MoE và so sánh tham số. |
| **GS-07** | point-and-explain | normal | **ĐẠT** | Nhận diện và giải thích đúng hiện tượng Spurious Cues. |
| **GS-08** | summary | normal | **ĐẠT** | Liệt kê đúng các đầu mục chính của Day 01. |
| **GS-09** | point-and-explain | hard_domain_specificity | **FAIL** | *Lỗi Domain:* AI giải thích chung chung về ý nghĩa các màu sắc trong thiết kế thay vì nhận diện 4 nhánh sản phẩm AI (Data, Model, Prompt, Eval) của khóa học. |
| **GS-10** | point-and-explain | hard_domain_specificity | **ĐẠT** | Giải thích tốt sơ đồ Scaled Dot-Product Attention. |
| **GS-11** | summary | hard_source_of_truth | **FAIL** | *Lỗi Hallucination:* AI vẫn cố bịa ra tóm tắt cho "Slide 80" dù slide Day 01 chỉ có tối đa 60 trang. |
| **GS-12** | summary | hard_source_of_truth | **FAIL** | *Lỗi Hallucination:* AI cố bịa ra phần giải thích về Fine-tuning trong Day 02 (thực tế Day 02 không dạy phần này). |
| **GS-13** | point-and-explain | hard_ambiguity | **FAIL** | *Lỗi Fallback:* AI trả lời chung chung về cách sử dụng công cụ VLearn thay vì báo lỗi thiếu vùng chọn và hướng dẫn người dùng crop ảnh. |
| **GS-14** | point-and-explain | hard_ambiguity | **FAIL** | *Lỗi Fallback:* AI nhận diện vùng crop trống nhưng vẫn cố giải thích slide theo dạng lý thuyết chung thay vì yêu cầu crop lại. |
| **GS-15** | summary | hard_out_of_scope | **FAIL** | *Lỗi Thẩm quyền:* AI vẫn viết toàn bộ code game Flappy Bird bằng pygame thay vì từ chối và hướng học viên quay lại bài học. |
| **GS-16** | summary | hard_out_of_scope | **FAIL** | *Lỗi Thẩm quyền:* AI bịa ra một deadline giả cho bài tập Day 2 thay vì từ chối và hướng dẫn kiểm tra Discord. |
| **GS-17** | point-and-explain | rare | **ĐẠT** | Giải thích dễ hiểu cơ chế xác suất cho học sinh cấp 1. |
| **GS-18** | summary | rare | **ĐẠT** | Tóm tắt đúng định dạng 3 dòng ngắn gọn theo yêu cầu. |
| **GS-19** | point-and-explain | normal | **ĐẠT** | Giải thích đúng khái niệm overkill của AI Agent. |
| **GS-20** | summary | rare | **ĐẠT** | Trích xuất tốt các ý về tri thức ẩn trong bài giảng sáng Day 02. |

---

## 3. Phân Tích Nguyên Nhân Thất Bại (Failure Modes Analysis)

Nhóm đã họp và đúc kết 3 nguyên nhân cốt lõi khiến lượt chạy 1 bị thất bại ở 8 cases:

1.  **Thiếu cơ chế Kiểm soát sự thật (Hallucination & Fake Citation):** 
    *   *Biểu hiện:* Ở case **GS-11** và **GS-12**, AI không kiểm tra độ dài slide hay sự tồn tại của chủ đề mà luôn cố gắng trả lời dựa trên dữ liệu huấn luyện có sẵn.
    *   *Giải pháp lượt 2:* Bổ sung System Instruction: *"Chỉ sử dụng thông tin trong tài liệu được cung cấp. Nếu thông tin không tồn tại hoặc vượt quá số trang hiện có, hãy trả lời: 'Tôi không tìm thấy...' và tuyệt đối không suy đoán."*
2.  **Chưa có cơ chế chặn ngoài phạm vi (Out-of-scope Bypass):**
    *   *Biểu hiện:* Ở case **GS-15** và **GS-16**, AI bị "jailbreak" dễ dàng để viết code game ngoài lề hoặc bịa deadline do không được thiết lập hàng rào bảo vệ (Guardrails).
    *   *Giải pháp lượt 2:* Xây dựng bộ lọc ý định (Intent Classifier) ở đầu vào. Nếu phát hiện các từ khóa liên quan đến trò chơi, logistics lớp học hoặc code ngoài khóa học, ngay lập tức kích hoạt prompt từ chối chuẩn hóa.
3.  **Lỗi nhận diện vùng chọn trống/mơ hồ (Ambiguity handling):**
    *   *Biểu hiện:* Ở case **GS-13** và **GS-14**, hệ thống không có lớp check dữ liệu đầu vào của ảnh crop, dẫn đến việc gửi ảnh trống cho mô hình và mô hình tự đoán bừa.
    *   *Giải pháp lượt 2:* Thêm đoạn code kiểm tra độ phân giải/kích thước vùng chọn của ảnh crop ở frontend. Nếu pixel quá nhỏ hoặc ảnh đơn sắc, hệ thống sẽ chặn trước khi gửi API và hiện popup yêu cầu quét lại.

---

## 4. Kế Hoạch Cho Lượt Chạy 2 (Tối Ưu Prompt & Code)

*   **Long:** Viết thêm middleware lọc intent để chặn các câu hỏi ngoài phạm vi (Out-of-scope).
*   **Phú:** Cải tiến prompt tóm tắt, bổ sung ràng buộc nghiêm ngặt về việc đính kèm trích dẫn `[trang N]` cho từng dòng gạch đầu dòng.
*   **Việt:** Thêm logic kiểm tra pixel vùng crop ở UI để chặn gửi ảnh rác lên API.
