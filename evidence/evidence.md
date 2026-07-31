# Evidence: phân tích chatlog

## 1. Nguồn dữ liệu

Phân tích file `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` (SHA-256 `400ce4ce5c1c58189be9ca0630bd517ca69cfcac637f0f802edec70f4f796cad`), gồm 2,522 dòng. Script tạo được **1,261 cặp hỏi–đáp**.

## 2. Cách ghép hỏi–đáp

Ghép theo (conversation_id, turn_id); mỗi turn hợp lệ ghép student với tutor thuộc cùng turn.

Lý do ưu tiên `turn_id`: file xuất có thể đặt tutor trước student dù hai message thuộc cùng một turn. Nếu không có `turn_id`, script sắp theo timestamp (fallback là thứ tự dòng) trong từng hội thoại và ghép student với tutor kế tiếp.

## 3. Định nghĩa heuristic

- **Yêu cầu tóm tắt:** prompt student chứa ít nhất một keyword: `tóm tắt`, `tóm gọn`, `tổng hợp`, `summary`, `ý chính`, `nội dung chính`, `cần nhớ`, `cần học`, `ghi chú`, `note`.
- **Câu hỏi hình ảnh:** prompt student chứa ít nhất một keyword: `hình`, `ảnh`, `bảng`, `biểu đồ`, `sơ đồ`, `khoanh`, `mũi tên`, `trục`, `nhánh màu`, `phần này`, `cái này`.
- **Citation rỗng:** null, chuỗi rỗng, `[]`, `{}`, sentinel tương đương (`none`, `nan`, `na`, `n/a`) hoặc JSON chỉ chứa giá trị rỗng.
- **Visual failure:** câu trả lời tutor của một visual request chứa ít nhất một phrase: `không thể xác định`, `không nhìn thấy`, `không có thông tin`, `không tìm thấy`, `vui lòng cung cấp thêm`.

Mọi phép dò dùng Unicode NFKC, không phân biệt hoa/thường và literal substring. Chi tiết rule máy đọc được nằm trong `summary.json`.

## 4. Kết quả

| Chỉ số | Số lượng | Tỷ lệ |
|---|---:|---:|
| Tổng cặp hỏi–đáp | 1,261 | 100.00% |
| Yêu cầu tóm tắt | 159 | 12.61% trên tổng cặp |
| Tóm tắt không citation | 101 | 63.52% trên yêu cầu tóm tắt |
| Tóm tắt có citation | 58 | 36.48% trên yêu cầu tóm tắt |
| Câu hỏi hình ảnh | 70 | 5.55% trên tổng cặp |
| Visual failure | 10 | 14.29% trên câu hỏi hình ảnh |
| Visual success theo rule | 60 | 85.71% trên câu hỏi hình ảnh |
| Citation rỗng ở mọi cặp | 582 | 46.15% trên tổng cặp |

Các nhóm có thể chồng lấn: 4 prompt đồng thời khớp summary và visual.

## 5. Ví dụ kiểm chứng

Mỗi liên kết dưới đây trỏ tới dòng vật lý bắt đầu của record tương ứng trong `examples.csv`. Trường nhiều dòng vẫn được giữ nguyên bằng CSV quoting.

### Summary không có citation

#### Ví dụ 1: `C0001` / `T0649` — [examples.csv, dòng 2](examples.csv#L2)

Student prompt:

```
(Trang 37, đoạn được chọn: "tóm tắt nội dung chính trong slide này")
tóm tắt nội dung chính trong slide này
```

Tutor answer:

```
Xin lỗi bạn, tôi không tìm thấy nội dung cụ thể cho slide 37 trong tài liệu hiện có. Bạn có thể cung cấp thêm thông tin hoặc tiêu đề của slide đó để tôi có thể hỗ trợ bạn chính xác hơn không?
```

Citations: `[]`

#### Ví dụ 2: `C0002` / `T0905` — [examples.csv, dòng 4](examples.csv#L4)

Student prompt:

```
(Trang 50, đoạn được chọn: "tóm gọn những nội dung quan trọng nhất trong day 04 này")
tóm gọn những nội dung quan trọng nhất trong day 04 này
```

Tutor answer:

```
Chào bạn, hiện tại tôi không tìm thấy tài liệu tổng hợp đầy đủ cho toàn bộ nội dung của Ngày 04 trong slide được cung cấp.

Nếu bạn có thắc mắc về một khái niệm cụ thể nào đó đã học trong buổi này (ví dụ: các kỹ thuật tối ưu hóa prompt, cơ chế gọi tool của agent, hoặc cách xử lý ngữ cảnh), hãy cho tôi biết tên khái niệm hoặc đoạn văn bản cụ thể mà bạn muốn tìm hiểu. Tôi sẽ tra cứu chi tiết và giải thích giúp bạn ngay nhé.
```

Citations: `[]`

#### Ví dụ 3: `C0015` / `T0541` — [examples.csv, dòng 8](examples.csv#L8)

Student prompt:

```
(Trang 2, đoạn được chọn: "Giúp tôi viết summary chi tiết và đầy đủ nhất về toàn bộ slide bài giảng ngày hôm nay")
Giúp tôi viết summary chi tiết và đầy đủ nhất về toàn bộ slide bài giảng ngày hôm nay
```

Tutor answer:

```
Rất tiếc, hiện tại trong nội dung slide bài giảng của ngày hôm nay không chứa thông tin chi tiết về khái niệm "ReAct Design Pattern" hay một bản tóm tắt tổng quát về toàn bộ các slide.

Để tôi có thể hỗ trợ bạn hiệu quả nhất, bạn có thể chia sẻ cụ thể hơn về các chủ đề hoặc các từ khóa quan trọng mà bạn muốn tóm tắt trong bài học hôm nay không? Tôi sẽ dựa vào nội dung đó để giải thích và tổng hợp giúp bạn.
```

Citations: `[]`

#### Ví dụ 4: `C0020` / `T0122` — [examples.csv, dòng 12](examples.csv#L12)

Student prompt:

```
(Trang 5, đoạn được chọn: "tóm tắt hết slice trong vài câu đi")
tóm tắt hết slice trong vài câu đi
```

Tutor answer:

```
Rất tiếc là mình đã thử tìm kiếm nội dung tổng quan từ các slide (với các từ khóa như "giới thiệu", "mục tiêu", "tóm tắt") nhưng hệ thống chưa trả về kết quả cụ thể để mình có thể khái quát lại toàn bộ bài học cho bạn.

Vì mình không có quyền truy cập trực tiếp vào toàn bộ tệp tài liệu mà phải thông qua tìm kiếm từ khóa, bạn có thể giúp mình bằng cách:
1. Cho mình biết **chủ đề chính** của buổi học hôm nay là gì (ví dụ: Giới thiệu về AI, Tìm kiếm theo chiều sâu, v.v.)?
2. Hoặc bạn có thể chụp/chép một đoạn nội dung quan trọng nào đó, mình sẽ dựa vào đó để tra cứu và tóm tắt giúp bạn ngay!
```

Citations: `[]`

#### Ví dụ 5: `C0031` / `T0408` — [examples.csv, dòng 18](examples.csv#L18)

Student prompt:

```
(Trang 14, đoạn được chọn: "tóm tắt các chủ đề chính của slide day05-lecture-slides-batch03.pdf này")
tóm tắt các chủ đề chính của slide day05-lecture-slides-batch03.pdf này
```

Tutor answer:

```
Rất tiếc, tôi không thể tìm thấy tệp tin hoặc nội dung chi tiết của `day05-lecture-slides-batch03.pdf` trong hệ thống hiện tại để tóm tắt các chủ đề chính cho bạn.

Bạn có thể cung cấp thêm thông tin hoặc tên cụ thể của chủ đề/khái niệm bạn đang muốn tìm hiểu trong ngày học này không? Tôi sẽ hỗ trợ bạn giải đáp ngay khi có nội dung cụ thể.
```

Citations: `[]`

### Visual failure

#### Ví dụ 1: `C0002` / `T0092` — [examples.csv, dòng 22](examples.csv#L22)

Student prompt:

```
(Trang 50, đoạn được chọn: "kỹ thuật tối ưu prompt, cơ chế gọi tool và cách xử lý ngữ cảnh")
kỹ thuật tối ưu prompt, cơ chế gọi tool và cách xử lý ngữ cảnh
```

Tutor answer:

```
Rất tiếc, tôi không tìm thấy tài liệu tổng hợp đầy đủ cho nội dung của Day 04 trong các file slide đã được cung cấp.

Để có thể giúp bạn tóm tắt chính xác, bạn có thể cho tôi biết tên các chủ đề hoặc mục tiêu học tập cụ thể trong Day 04 được ghi chú trong giáo trình của bạn không? Khi có thông tin đó, tôi sẽ giúp bạn giải thích từng phần về kỹ thuật tối ưu prompt, cơ chế gọi tool và quản lý ngữ cảnh một cách cụ thể nhất.
```

Citations: `[]`

#### Ví dụ 2: `C0051` / `T0083` — [examples.csv, dòng 26](examples.csv#L26)

Student prompt:

```
(Trang 52, đoạn được chọn: "có tính năng slide toàn màn hình không")
có tính năng slide toàn màn hình không 
```

Tutor answer:

```
Rất tiếc, tôi đã kiểm tra lại tài liệu bài giảng được cung cấp nhưng không tìm thấy thông tin nào đề cập đến tính năng slide toàn màn hình. Có vẻ như tính năng này không được mô tả trong nội dung của buổi học hôm nay.
```

Citations: `[]`

#### Ví dụ 3: `C0108` / `T0816` — [examples.csv, dòng 28](examples.csv#L28)

Student prompt:

```
(Trang 2, đoạn được chọn: "người trong ảnh là ai")
người trong ảnh là ai
```

Tutor answer:

```
Rất xin lỗi bạn, trong tài liệu của bài học hôm nay không có thông tin hay hình ảnh nào về danh tính của một cá nhân cụ thể. Nội dung tài liệu tập trung vào các tiêu chí thiết kế chỉ số (metric) cho tính năng AI [trang 59].

Nếu bạn đang thắc mắc về một hình ảnh nào đó trong slide, có thể đó là ví dụ minh họa hoặc thông tin nằm ngoài phạm vi tài liệu kỹ thuật này.
```

Citations: `[59]`

#### Ví dụ 4: `C0322` / `T0405` — [examples.csv, dòng 32](examples.csv#L32)

Student prompt:

```
(Trang 1, đoạn được chọn: "làm sao để cái này dánh giá hoàn thành của slide")
làm sao để cái này dánh giá hoàn thành của slide 
```

Tutor answer:

```
Rất tiếc, tôi không tìm thấy thông tin cụ thể về cách đánh giá hoàn thành slide trong nội dung của bài học ngày hôm nay. Thông thường, việc đánh giá này có thể nằm ở các yêu cầu của giảng viên trên hệ thống LMS hoặc thông qua các bài tập đi kèm với bài giảng. Bạn có thể kiểm tra lại hướng dẫn trong môn học hoặc hỏi trực tiếp giảng viên về quy định cụ thể cho phần này nhé.
```

Citations: `[]`

#### Ví dụ 5: `C0346` / `T0840` — [examples.csv, dòng 34](examples.csv#L34)

Student prompt:

```
(Trang 59, đoạn được chọn: "phân tích hình ảnh được khoanh đỏ ở slide 59")
phân tích hình ảnh được khoanh đỏ ở slide 59
```

Tutor answer:

```
Rất tiếc, tôi không tìm thấy thông tin hoặc hình ảnh cụ thể được khoanh đỏ tại slide 59 trong tài liệu bài giảng được cung cấp. Có vẻ như nội dung đó không hiển thị trong dữ liệu slide hiện có của tôi.

Bạn có thể cung cấp thêm thông tin về chủ đề hoặc nội dung hình ảnh đó không? Tôi sẽ dựa vào đó để hỗ trợ bạn phân tích.
```

Citations: `[]`

## 6. Hạn chế

Đây là keyword heuristic nên có thể có false positive (ví dụ `hình` trong “mô hình” không nhất thiết đòi hỏi nhìn ảnh, hoặc `note` xuất hiện trong ngữ cảnh khác) và false negative (cách diễn đạt không chứa keyword).

“Visual success” chỉ có nghĩa là câu trả lời không chứa failure phrase đã định nghĩa; nó không chứng minh câu trả lời đúng. Tương tự, citation không rỗng không chứng minh nguồn trích dẫn phù hợp.

Ghép theo `turn_id` phụ thuộc tính đúng của ID do hệ thống nguồn cung cấp; fallback theo thời gian có thể sai nếu CSV không có timestamp đáng tin cậy hoặc hội thoại không luân phiên student/tutor.

## 7. Tái hiện

Chạy từ thư mục gốc repository:

```bash
python scripts/analyze_chatlog.py \
  --input data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv \
  --output-dir evidence
```

Lần chạy sẽ ghi đè bốn artifact trong `evidence/` bằng kết quả tính lại từ CSV đầu vào; không có số liệu kết quả nào được hard-code.
