# Reflection — Long

## Vai trò và phần đã làm

Long phụ trách AI Spec, mining/evidence report và phần orchestration/fallback của backend. Phần này nối payload từ UI với phân loại intent, retrieval theo tài liệu, grounding/citation verification và trace.

## AI hỗ trợ thế nào

AI hỗ trợ đọc code, rà các failure mode, viết test scaffold và gợi ý cách kiểm chứng. Quyết định cuối vẫn dựa trên output/trace trong `eval/`, không dựa trên mô tả của model.

## Bài học từ case fail

Run 12 cho thấy con số tổng có thể gây hiểu nhầm khi 5 case được rule xử lý và không gọi model. Bài học là phải tách AI-only và RULE trong report, giữ trace `model: null` để người khác audit được, và không dùng một phần trăm đẹp để đại diện cho toàn hệ thống.
