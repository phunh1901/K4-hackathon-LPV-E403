/* =============================================================
   data.js — Nội dung giả lập cho prototype CP2
   TẤT CẢ dữ liệu ở file này là MOCK (dữ liệu giả tự sinh).
   Không lấy từ data pack thật của khoá.
   ============================================================= */

const DOC = {
  file: 'material_95eb786b4d9e.pdf',
  course: 'COMP2010',
  code: 'Lecture_material_ms203vsq_ob7vqp',
  totalPages: 76,
  instructor: 'Mai Anh Nguyen (Blue)',
};

/* Cây học liệu bên trái ------------------------------------------------ */
const CHAPTERS = [
  {
    id: 'day01', title: 'Day01', status: 'PUBLISHED', docs: [
      { name: 'material_2c81f0a7be.pdf', pages: 54, done: true },
      { name: 'worksheet_day01.pdf', pages: 8, done: true },
    ]
  },
  {
    id: 'day02', title: 'Day02', status: 'PUBLISHED', studying: true, open: true, docs: [
      { name: DOC.file, pages: 76, done: true, active: true },
    ]
  },
  {
    id: 'day03', title: 'Day03', status: 'PUBLISHED', docs: [
      { name: 'material_7fa3c19d02.pdf', pages: 61, done: false },
      { name: 'checklist_hax_pair.pdf', pages: 4, done: false },
    ]
  },
  {
    id: 'day04', title: 'Day04', status: 'PUBLISHED', docs: [
      { name: 'material_be40d7c115.pdf', pages: 48, done: false },
      { name: 'golden_set_template.pdf', pages: 6, done: false },
      { name: 'eval_playbook.pdf', pages: 12, done: false },
    ]
  },
  {
    id: 'day05', title: 'Day05', status: 'PUBLISHED', docs: [
      { name: 'material_09cc5e2a41.pdf', pages: 39, done: false },
      { name: 'user_test_script.pdf', pages: 5, done: false },
      { name: 'demo_rubric.pdf', pages: 3, done: false },
    ]
  },
  {
    id: 'day06', title: 'Day06', status: 'PUBLISHED', docs: [
      { name: 'material_a1d8b3f720.pdf', pages: 27, done: false },
    ]
  },
];

/* Các trang được viết tay ---------------------------------------------- */
const AUTHORED = {
  1: {
    kind: 'title',
    eyebrow: 'AI IN ACTION · DAY 02',
    title: 'Xác định <em>bài toán</em> cho AI.',
    sub: 'Từ <b>yêu cầu mơ hồ</b> đến <b>Problem Statement</b> rõ ràng.',
    foot: 'Instructor: ' + DOC.instructor,
  },
  2: {
    kind: 'profile',
    title: 'Instructor',
    name: DOC.instructor,
    role: 'AI Product Lead · 9 năm làm sản phẩm dữ liệu',
    bullets: [
      'Từng dẫn 14 dự án AI nội bộ, 5 dự án dừng ở giai đoạn scoping.',
      'Chủ đề quan tâm: cost-of-error, automation level, human-in-the-loop.',
      'Buổi hôm nay: cách viết một Problem Statement mà kỹ sư build được ngay.',
    ],
    foot: 'MỞ ĐẦU · GIẢNG VIÊN',
  },
  3: {
    kind: 'numbered',
    title: 'Bốn câu hỏi của buổi học',
    sub: '— Từ xác định bài toán đến quyết định ứng dụng AI',
    items: [
      'Bài toán có thực sự cần <b>AI</b> giải quyết?',
      'Nếu có, giải pháp ở cấp độ nào: <b>Rule</b>, <b>Workflow</b>, hay <b>Agent</b>?',
      '<b>Problem Statement</b> đã đủ rõ ràng để triển khai?',
      'Khi nào quyết định: <b>Go</b>, <b>Not Yet</b>, hay <b>No-Go</b>?',
    ],
    foot: 'MỞ ĐẦU · 4 CÂU HỎI',
  },
  4: {
    kind: 'stats',
    title: 'Vì sao phần lớn dự án AI chết sớm',
    sub: 'Không phải vì mô hình yếu — mà vì bài toán chưa bao giờ được viết ra.',
    stats: [
      { big: '62%', small: 'dự án dừng ở giai đoạn scoping vì không thống nhất được đầu ra' },
      { big: '4/5', small: 'team không nêu được ai là người dùng cuối của quyết định AI' },
      { big: '0', small: 'chỉ số thành công được định nghĩa trước khi viết dòng code đầu tiên' },
    ],
    foot: 'PHẦN 1 · BỐI CẢNH',
  },
  5: {
    kind: 'divider',
    eyebrow: 'PHẦN 1',
    title: 'Bài toán có cần AI không?',
    sub: 'Sàng trước khi build.',
  },
  6: {
    kind: 'bullets',
    title: 'Ba câu hỏi sàng lọc',
    items: [
      '<b>Đầu vào có mơ hồ không?</b> Nếu input luôn có cấu trúc cố định → viết rule, đừng gọi model.',
      '<b>Sai thì tốn bao nhiêu?</b> Cost-of-error quyết định mức tự động hoá, không phải độ ngầu của mô hình.',
      '<b>Có nguồn sự thật không?</b> Không có nguồn để đối chiếu thì mọi câu trả lời đều là phỏng đoán có văn phong tốt.',
    ],
    foot: 'PHẦN 1 · SÀNG LỌC',
  },
  7: {
    kind: 'compare',
    title: 'Rule · Workflow · Agent',
    sub: 'Ba cấp độ giải pháp — chọn thấp nhất mà vẫn giải được bài toán.',
    cols: [
      { head: 'Rule', tone: 'ok', items: ['Input có cấu trúc', 'Quyết định nhị phân', 'Giải thích được 100%', 'Rẻ, nhanh, dễ test'] },
      { head: 'Workflow', tone: 'warn', items: ['Nhiều bước cố định', 'Có gọi model ở 1-2 chốt', 'Trace được từng bước', 'Chi phí trung bình'] },
      { head: 'Agent', tone: 'risk', items: ['Đường đi không đoán trước', 'Tự chọn công cụ', 'Khó test, khó trace', 'Chỉ dùng khi bắt buộc'] },
    ],
    foot: 'PHẦN 1 · CẤP ĐỘ GIẢI PHÁP',
  },
  12: {
    kind: 'quote',
    quote: 'Nếu bạn không viết được bài toán trong một câu, bạn chưa hiểu bài toán — bạn mới chỉ thích ý tưởng.',
    by: 'Nguyên tắc một câu · Day 02',
    foot: 'PHẦN 1 · CHỐT',
  },
  30: {
    kind: 'divider',
    eyebrow: 'PHẦN 2',
    title: 'Viết Problem Statement',
    sub: 'Không có chữ "AI" trong đó.',
  },
  48: {
    kind: 'compare',
    title: 'Yêu cầu mơ hồ vs. Problem Statement',
    sub: 'Cùng một mong muốn, hai mức độ build được.',
    cols: [
      { head: '✗ Mơ hồ', tone: 'risk', items: ['"Làm AI hỗ trợ học viên"', 'Không rõ ai dùng', 'Không rõ lúc nào dùng', 'Không đo được'] },
      { head: '✓ Rõ ràng', tone: 'ok', items: ['"Học viên đang đọc slide, bôi đen một đoạn khó, cần giải thích kèm trích dẫn trang"', 'Một người dùng', 'Một thời điểm', 'Một chỉ số'] },
    ],
    foot: 'PHẦN 2 · SO SÁNH',
  },
  66: {
    kind: 'bullets',
    title: 'Từ yêu cầu mơ hồ → Problem Statement',
    sub: 'Ba bước làm sạch trước khi đưa cho kỹ sư.',
    items: [
      '<b>Bước 1 — Cắt lát.</b> Một người dùng · một công việc · một quyết định · một kết quả.',
      '<b>Bước 2 — Gắn số.</b> Bao nhiêu người × tần suất × tốn gì mỗi lần.',
      '<b>Bước 3 — Khai ranh giới.</b> Cái gì hệ thống <i>không</i> làm, và khi nào nó phải nhường lại cho người.',
    ],
    foot: 'PHẦN 3 · QUY TRÌNH',
  },
  67: {
    kind: 'framework',
    title: '# Problem Statement cho hệ thống AI',
    sub: '6 yếu tố bài toán cốt lõi + 3 yếu tố quyết định AI',
    groupA: {
      label: '6 yếu tố bài toán cốt lõi',
      items: [
        { k: 'Actor', v: 'Ai là người chịu tác động của quyết định này?' },
        { k: 'Workflow', v: 'Họ đang ở bước nào trong luồng công việc?' },
        { k: 'Bottleneck', v: 'Chỗ nghẽn thật sự nằm ở đâu?' },
        { k: 'Impact', v: 'Nghẽn đó tốn gì: thời gian, tiền, hay niềm tin?' },
        { k: 'Success Metric', v: 'Đo bằng con số nào thì biết đã giải được?' },
        { k: 'Boundary', v: 'Ranh giới: cái gì nằm ngoài phạm vi?' },
      ]
    },
    groupB: {
      label: '3 yếu tố quyết định AI',
      items: [
        { k: 'Ambiguity', v: 'Input có mơ hồ đến mức cần suy luận không?' },
        { k: 'Cost of error', v: 'Sai một lần thì hậu quả tới đâu?' },
        { k: 'Ground truth', v: 'Có nguồn sự thật để đối chiếu câu trả lời không?' },
      ]
    },
    foot: 'PHẦN 3 · KHUNG',
  },
  68: {
    kind: 'template',
    title: 'Điền vào khung',
    sub: 'Một câu duy nhất — dán thẳng vào spec.md §4.',
    lines: [
      '<u>&nbsp;&nbsp;&nbsp;một người dùng&nbsp;&nbsp;&nbsp;</u> khi <u>&nbsp;&nbsp;&nbsp;đang làm việc gì&nbsp;&nbsp;&nbsp;</u>',
      'cần <u>&nbsp;&nbsp;&nbsp;một quyết định AI&nbsp;&nbsp;&nbsp;</u>',
      'để đạt <u>&nbsp;&nbsp;&nbsp;một kết quả đo được&nbsp;&nbsp;&nbsp;</u>.',
    ],
    foot: 'PHẦN 3 · TEMPLATE',
  },
  75: {
    kind: 'bullets',
    title: 'Go · Not Yet · No-Go',
    items: [
      '<b>Go</b> — có nguồn sự thật, cost-of-error chịu được, lát cắt demo được trong 5 phút.',
      '<b>Not Yet</b> — bài toán đúng nhưng thiếu data hoặc thiếu chỉ số. Đi lấy bằng chứng trước.',
      '<b>No-Go</b> — rule giải được, hoặc sai một lần là mất niềm tin không cứu được.',
    ],
    foot: 'PHẦN 4 · QUYẾT ĐỊNH',
  },
  76: {
    kind: 'title',
    eyebrow: 'AI IN ACTION · DAY 02',
    title: 'Hết Day 02.',
    sub: 'Việc về nhà: viết lát cắt <b>một câu</b> cho nhóm mình.',
    foot: 'Instructor: ' + DOC.instructor,
  },
};

/* Sinh nội dung cho các trang còn lại ---------------------------------- */
const SECTIONS = [
  { from: 1, to: 12, name: 'PHẦN 1 · BÀI TOÁN CÓ CẦN AI?' },
  { from: 13, to: 29, name: 'PHẦN 1 · CẤP ĐỘ GIẢI PHÁP' },
  { from: 30, to: 47, name: 'PHẦN 2 · PROBLEM STATEMENT' },
  { from: 48, to: 65, name: 'PHẦN 2 · VÍ DỤ THỰC TẾ' },
  { from: 66, to: 72, name: 'PHẦN 3 · KHUNG 6+3' },
  { from: 73, to: 76, name: 'PHẦN 4 · QUYẾT ĐỊNH' },
];

const FILLER_TITLES = [
  'Ví dụ: trợ lý trả lời trong Discord', 'Khi nào rule thắng model',
  'Đo cost-of-error bằng ba câu hỏi', 'Ranh giới thẩm quyền của hệ thống',
  'Nguồn sự thật: có, một phần, hay không có?', 'Input mơ hồ — hỏi lại hay đoán?',
  'Bốn đường đi trải nghiệm', 'Mức tự động hoá và người ở đâu trong vòng lặp',
  'Bảng impact: ba ứng viên', 'Ứng viên bị loại và lý do',
  'Non-goals — viết ra để khỏi trôi', 'Chỉ số thành công phải kiểm chứng được',
  'Case: học viên hỏi deadline', 'Case: học viên bôi đen đoạn khó',
  'Case: câu hỏi ngoài tài liệu', 'Trace và log: build từ ngày đầu',
  'Golden set bắt đầu từ đâu', 'Quality bar: con số, không phải cảm giác',
];

const FILLER_BULLETS = [
  'Viết ra người dùng cụ thể trước, đừng viết "người dùng".',
  'Một quyết định mỗi lát cắt — hai quyết định là hai dự án.',
  'Nếu không đo được thì chưa phải chỉ số, mới là mong muốn.',
  'Mọi câu trả lời phải trỏ về được một nguồn kiểm lại được.',
  'Không có căn cứ thì nói không biết, đừng viết cho tròn câu.',
  'Ranh giới viết trước khi build, không viết sau khi bị hỏi.',
  'Cost-of-error cao → giữ người trong vòng lặp.',
  'Trace từng bước, nếu không thì không debug được lúc demo.',
];

function fillerFor(n) {
  const t = FILLER_TITLES[(n * 7) % FILLER_TITLES.length];
  const k = n % 3;
  const sec = SECTIONS.find(s => n >= s.from && n <= s.to);
  const foot = (sec ? sec.name : 'DAY 02');
  if (k === 0) {
    return {
      kind: 'bullets', title: t, foot,
      items: [0, 1, 2].map(i => FILLER_BULLETS[(n + i * 3) % FILLER_BULLETS.length])
    };
  }
  if (k === 1) {
    return {
      kind: 'numbered', title: t, sub: '— Ghi chú buổi học',
      items: [0, 1, 2, 3].map(i => FILLER_BULLETS[(n * 2 + i) % FILLER_BULLETS.length]), foot
    };
  }
  return {
    kind: 'compare', title: t, sub: '— Hai hướng xử lý',
    cols: [
      { head: 'Nên', tone: 'ok', items: [0, 1].map(i => FILLER_BULLETS[(n + i) % FILLER_BULLETS.length]) },
      { head: 'Tránh', tone: 'risk', items: [0, 1].map(i => FILLER_BULLETS[(n + 4 + i) % FILLER_BULLETS.length]) },
    ], foot
  };
}

const PAGES = Array.from({ length: DOC.totalPages }, (_, i) => {
  const n = i + 1;
  return Object.assign({ n }, AUTHORED[n] || fillerFor(n));
});

/* Câu trả lời mock của tutor -------------------------------------------
   CP2 chưa gọi AI thật. Hàm mockAnswer() là chỗ duy nhất sẽ được thay
   bằng lời gọi model thật ở CP3 — xem codebase/README.md.
   --------------------------------------------------------------------- */
const ANSWERS = {
  framework: {
    conf: 85,
    body: [
      'Theo tài liệu của buổi học, trang 67 liệt kê <b>6 yếu tố bài toán cốt lõi</b> (Actor, Workflow, Bottleneck, Impact, Success Metric, Boundary) [trang 67].',
      'Nội dung tại trang 67 cũng có đề cập đến "<b>3 yếu tố quyết định AI</b>" bên cạnh 6 yếu tố bài toán này, mặc dù danh sách chi tiết của 3 yếu tố quyết định không hiển thị đầy đủ trong đoạn tóm tắt [trang 67].',
    ],
    sources: [{ page: 67, text: '“# Problem Statement cho hệ thống AI”' }],
  },
  levels: {
    conf: 88,
    body: [
      'Ba cấp độ giải pháp được trình bày ở trang 7: <b>Rule</b> cho input có cấu trúc và quyết định nhị phân, <b>Workflow</b> cho luồng nhiều bước cố định có gọi model ở một vài chốt, <b>Agent</b> cho đường đi không đoán trước [trang 7].',
      'Nguyên tắc chọn: lấy cấp độ <i>thấp nhất</i> mà vẫn giải được bài toán, vì càng lên cao càng khó test và khó trace [trang 7].',
    ],
    sources: [{ page: 7, text: '“Rule · Workflow · Agent — chọn thấp nhất mà vẫn giải được”' }],
  },
  statement: {
    conf: 81,
    body: [
      'Problem Statement theo khung của buổi học không chứa chữ "AI". Nó gồm một người dùng, một công việc, một quyết định và một kết quả đo được [trang 68].',
      'Trang 48 đối chiếu trực tiếp một yêu cầu mơ hồ với một Problem Statement rõ ràng để bạn thấy khác biệt ở bốn chỗ: ai dùng, lúc nào dùng, quyết định gì, đo bằng gì [trang 48].',
    ],
    sources: [
      { page: 68, text: '“Điền vào khung — một câu duy nhất”' },
      { page: 48, text: '“Yêu cầu mơ hồ vs. Problem Statement”' },
    ],
  },
  generic: {
    conf: 74,
    body: [
      'Đoạn bạn đang xem nằm trong phần trình bày về cách viết bài toán trước khi build. Ý chính: mô tả người dùng và thời điểm cụ thể, rồi mới nói tới giải pháp [trang {p}].',
      'Nếu bạn muốn đi sâu hơn, trang 67 có khung 6+3 yếu tố để soi lại bài toán của nhóm mình [trang 67].',
    ],
    sources: [{ page: 67, text: '“# Problem Statement cho hệ thống AI”' }],
  },
  lowconf: {
    conf: 41,
    kind: 'low',
    body: [
      'Mình <b>chưa chắc</b> về câu này. Trong phạm vi tài liệu Day 02 mình không tìm được đoạn nào nói trực tiếp về điều bạn hỏi.',
      'Phần gần nhất là trang 66 nói về ba bước làm sạch yêu cầu [trang 66] — nhưng đây có thể không đúng ý bạn.',
    ],
    sources: [{ page: 66, text: '“Từ yêu cầu mơ hồ → Problem Statement”' }],
  },
  clarify: {
    conf: 0,
    kind: 'clarify',
    body: ['Câu hỏi của bạn đang thiếu ngữ cảnh nên mình chưa trả lời chắc được. Bạn muốn hỏi về ý nào?'],
    chips: ['Giải thích đoạn vừa bôi đen', 'So sánh Rule / Workflow / Agent', 'Cách viết Problem Statement'],
  },
  outofscope: {
    conf: 0,
    kind: 'refuse',
    body: [
      'Câu này nằm <b>ngoài phạm vi</b> tài liệu môn học nên mình không trả lời từ suy đoán.',
      'Thông tin về deadline, cách nộp bài và điểm số nằm ở kênh thông báo chính thức của khoá. Mình có thể chuyển câu hỏi cho TA nếu bạn muốn.',
    ],
    actions: ['Chuyển cho TA', 'Mở kênh thông báo'],
  },
  region: {
    conf: 79,
    body: [
      'Vùng bạn chọn ở <b>trang {p}</b> là phần khung trình bày các yếu tố của bài toán. Mình đọc được tiêu đề khối và các cặp <i>khái niệm — câu hỏi kiểm tra</i> trong vùng đó [trang {p}].',
      'Muốn mình giải thích riêng một yếu tố nào trong vùng này thì gõ tên yếu tố đó nhé.',
    ],
    sources: [{ page: 0, text: '“Vùng ảnh đã chọn trên slide”' }],
  },
};

/* Lịch sử hội thoại có sẵn khi mở panel */
const SEED_CHAT = [
  { role: 'user', text: 'trang 67 nói về cái gì vậy', ctxPage: 67 },
  { role: 'ai', key: 'framework', ctxPage: 67 },
];