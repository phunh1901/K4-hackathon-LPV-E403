# Validation log — VLearn Study Focus

Ngày lập log: 2026-07-31

## Trạng thái trung thực

Working tree hiện **chưa có bản ghi user test đã thực hiện** (không có quote, timestamp hoặc quan sát thao tác nào được lưu). Vì vậy tài liệu này không giả tạo kết quả validation và không đánh dấu CP5 đã hoàn tất.

Danh sách willing users đã khai trong `spec.md` §8: **Chiến, Phúc, Kiên**. Đây là danh sách người đồng ý thử trước demo, không phải bằng chứng rằng buổi thử đã diễn ra.

## Protocol cần chạy

Mỗi người dùng thử prototype trong 10 phút, không được hướng dẫn giữa chừng:

1. Mở một PDF bài học, chọn một đoạn text và hỏi giải thích.
2. Crop một vùng sơ đồ/code và hỏi AI.
3. Yêu cầu tóm tắt toàn bộ tài liệu với mục tiêu và độ dài cụ thể.
4. Gõ một câu chưa có trong golden set để kiểm tra khả năng xử lý câu lạ.

Sau đó hỏi đúng ba câu:

- “Điều gì khó hiểu hoặc khó chịu nhất?”
- “Bạn có tin kết quả này không — vì sao?”
- “Bạn có dùng thật không — vì sao / vì sao chưa?”

## Bảng ghi nhận

| Người thử (vai) | Task | Quan sát thao tác | Quote nguyên văn | Mức nghiêm trọng | Trạng thái |
|---|---|---|---|---|---|
| Chiến | Chưa chạy | Chưa ghi nhận | Chưa có | — | Cần thực hiện |
| Phúc | Chưa chạy | Chưa ghi nhận | Chưa có | — | Cần thực hiện |
| Kiên | Chưa chạy | Chưa ghi nhận | Chưa có | — | Cần thực hiện |
| Người ngoài nhóm #4 | Chưa có người được chỉ định | Chưa ghi nhận | Chưa có | — | Cần bổ sung |
| Người ngoài nhóm #5 | Chưa có người được chỉ định | Chưa ghi nhận | Chưa có | — | Cần bổ sung |

## Những gì có thể kết luận trước user test

- Technical/browser audit đã ghi nhận summary end-to-end, crop và citation verification; xem `CHECKPOINT_3_AUDIT.md`.
- Golden-set failure đáng kể nhất ở các lượt trước là GS-14: model chọn `refuse` nhưng trượt exact term `ngoài phạm vi`; không sửa golden set sau khi xem output.
- Feedback UI 👍/👎 hiện chưa lưu backend; đây là backlog kỹ thuật được ghi trong `codebase/README.md`.

## Cách đóng log

Sau mỗi phiên, thay dòng tương ứng bằng tên/vai thật, task đã giao, quan sát, quote nguyên văn và mức nghiêm trọng; thêm một mục “Decision” ghi thay đổi làm trước demo hoặc lý do giữ nguyên. Chỉ khi có ≥5 mẩu từ ≥5 người ngoài nhóm mới coi R6 là hoàn tất.
