# Reflection — Việt

## Vai trò và phần đã làm

Việt phụ trách giao diện đọc PDF, bôi đen/crop và point-and-explain vision pipeline. Crop được lấy từ pixel canvas thật; text layer của slide được gửi kèm để giảm lỗi đọc số/chữ trong hình.

## AI hỗ trợ thế nào

AI hỗ trợ rà flow UI, tạo case kiểm thử ảnh và phân tích lỗi model dựng markdown làm vỡ JSON. Phần chạy thật được kiểm bằng trace có model, request ID và token usage.

## Bài học từ case fail

Case GS-19 làm cả lượt hỏi thành `error` vì model dựng bảng markdown chứa dấu ngoặc kép và ký tự `|` trong JSON. Bài học là output contract phải chịu được cách diễn đạt tự nhiên của model: prompt cần ràng buộc định dạng, parser cần retry có giới hạn, và một case lỗi không được làm mất toàn bộ lượt chạy.
