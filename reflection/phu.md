# Reflection — Phú

## Vai trò và phần đã làm

Phú phụ trách summary pipeline và prompt engineering: giới hạn độ dài, giữ phạm vi summary theo yêu cầu người học, đưa toàn bộ tài liệu vào context khi cần và định dạng output có citation.

## AI hỗ trợ thế nào

AI hỗ trợ tạo biến thể prompt, rà JSON schema và phân tích các output lệch golden set. Các thay đổi được giữ lại hoặc loại bỏ theo kết quả chạy thật, gồm cả Run 14 bị tụt điểm.

## Bài học từ case fail

Run 14 cho thấy hạ temperature về 0 để tăng tính tái lập không tự động làm chất lượng tăng: điểm giảm từ Run 13 xuống 20/24. Vì vậy cần ghi nhận cả lượt chạy xấu, phân biệt mục tiêu tái lập với mục tiêu điểm số, và không quay lại cấu hình cũ chỉ để lấy số đẹp.
