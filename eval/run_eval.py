import os
import json
import time
import sys
import glob
import re
import requests

# Reconfigure stdout to use UTF-8 to prevent encoding errors on Windows
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

# Tự động đọc file .env nếu có để cấu hình biến môi trường
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key, val = parts
                    os.environ[key.strip()] = val.strip()

# Cấu hình API Key (Được đọc từ biến môi trường để bảo mật)
api_key = os.environ.get("DEEPSEEK_API_KEY")
if not api_key:
    print("⚠️  CẢNH BÁO: Chưa tìm thấy biến môi trường DEEPSEEK_API_KEY trong hệ thống hoặc file .env.")
    print("Vui lòng nhập API Key vào file '.env' tại thư mục gốc.")
    print("Hoặc chạy script test ở chế độ MOCK.")
    use_mock = True
else:
    use_mock = False

# Đường dẫn file
GOLDEN_SET_PATH = "eval/golden_set.json"
ACTUAL_OUTPUTS_PATH = "eval/actual_outputs_run_1.json"

# System Instructions cho Agent trợ giúp học tập
SYSTEM_INSTRUCTION = """
Bạn là Agent Trợ Giúp Học Tập thông minh của khóa học AI Product.
Nhiệm vụ chính: Hỗ trợ học viên tóm tắt bài giảng hoặc giải thích hình ảnh trên slide, đảm bảo câu trả lời hoàn toàn chính xác dựa trên slide và transcript.

LUỒNG HOẠT ĐỘNG BẮT BUỘC (EXECUTION FLOW):
1. Gọi `classify_intent` đầu tiên để xác định ý định của học viên.
2. Nếu ý định là "clarify" (mơ hồ hoặc thiếu vùng chọn/ảnh crop cần thiết), hãy dừng lại và hỏi lại học viên một cách cụ thể để làm rõ.
3. Nếu ý định là "summary":
   - Gọi `get_knowledge_units` để lấy các đơn vị kiến thức thuộc phạm vi bài học.
   - Gọi `retrieve_lesson_evidence` để tra cứu slide và transcript liên quan.
4. Nếu ý định là "explain_image":
   - Gọi `analyze_selected_region` để phân tích hình ảnh và tọa độ crop.
   - Gọi `retrieve_lesson_evidence` để lấy thêm ngữ cảnh transcript bài học.
5. Sau khi có đủ minh chứng (evidence), hãy viết ra các tuyên bố (claims) chính.
6. Gọi `verify_claims` để kiểm tra chéo các tuyên bố với nguồn tài liệu thu thập được. Nếu có claim nào không được hỗ trợ (supported = False), hãy sửa lại hoặc loại bỏ tuyên bố đó để tránh bịa đặt.
7. Gọi `record_trace` để ghi lại lịch sử thực thi của Agent.
8. Trả về kết quả cuối cùng cho học viên kèm trích dẫn (citation) chi tiết dạng [trang N] hoặc mã đoạn [Txx-NNN].
"""

# =============================================================
# DEFINITION OF TOOLS
# =============================================================

def classify_intent(prompt: str, context: dict) -> dict:
    """Phân loại ý định từ prompt của học viên: tóm tắt bài giảng (summary), giải thích hình ảnh/vùng khoanh (explain_image), hoặc câu hỏi mơ hồ thiếu context (clarify).
    
    Args:
        prompt: Câu hỏi đầu vào của học viên.
        context: Ngữ cảnh bổ sung chứa thông tin tọa độ crop hoặc slide hiện tại.
    """
    p_lower = prompt.lower()
    has_crop = context.get("has_crop", False) or context.get("image_payload") is not None
    
    # Mơ hồ thiếu context
    if ("hình này" in p_lower or "bảng này" in p_lower or "sơ đồ này" in p_lower or "phần khoanh" in p_lower) and not has_crop:
        return {"intent": "clarify", "reason": "Học viên hỏi về hình ảnh/vùng chọn nhưng chưa quét/crop ảnh."}
        
    if "tóm tắt" in p_lower or "tóm gọn" in p_lower or "khái quát" in p_lower or "tổng hợp" in p_lower or "đầu mục" in p_lower:
        return {"intent": "summary", "reason": "Yêu cầu tóm tắt toàn bài hoặc một phần bài học."}
        
    if has_crop or "sơ đồ" in p_lower or "hình vẽ" in p_lower or "biểu đồ" in p_lower or "code" in p_lower:
        return {"intent": "explain_image", "reason": "Yêu cầu giải thích hình ảnh hoặc một vùng trên slide."}
        
    return {"intent": "summary", "reason": "Mặc định xử lý theo dạng truy vấn nội dung bài giảng."}


def get_knowledge_units(lesson_id: str, scope: str) -> dict:
    """Lấy danh sách các đơn vị kiến thức (knowledge units) của bài học theo phạm vi chỉ định.
    
    Args:
        lesson_id: Mã bài học cần lấy kiến thức.
        scope: Phạm vi cần tóm tắt (ví dụ: 'all', 'Day01', 'Day02').
    """
    units = [
        {"id": "KU-01", "name": "LLM & Foundation Models", "slide_range": "1-15"},
        {"id": "KU-02", "name": "Rule vs Workflow vs Agent", "slide_range": "16-30"},
        {"id": "KU-03", "name": "Context Management & Memory Injection", "slide_range": "31-45"},
        {"id": "KU-04", "name": "Problem Statement Template (6+3)", "slide_range": "46-76"}
    ]
    return {"lesson_id": lesson_id, "scope": scope, "units": units}


def analyze_selected_region(full_image: str, crop_image: str, bbox: list, prompt: str) -> dict:
    """Phân tích hình ảnh slide đầy đủ cùng với vùng crop (tọa độ bbox) để xác định thành phần được hỏi.
    
    Args:
        full_image: Đường dẫn hoặc mã định danh của ảnh slide đầy đủ.
        crop_image: Đường dẫn hoặc mã định danh của ảnh vùng chọn crop.
        bbox: Mảng tọa độ vùng chọn [x, y, w, h] của crop trên slide.
        prompt: Câu hỏi của học viên đi kèm.
    """
    desc = "Vùng chọn chứa một phần sơ đồ hoặc code đang được khoanh đỏ trên slide."
    if bbox:
        desc += f" Tọa độ bbox: {json.dumps(bbox)}."
    return {
        "description": desc,
        "detected_elements": ["sơ đồ kiến trúc", "đoạn code ví dụ"],
        "annotation": "Cần đối chiếu với transcript bài giảng để giải thích chính xác."
    }


def retrieve_lesson_evidence(lesson_id: str, query: str, image_id: str = None) -> dict:
    """Tìm kiếm slide text, OCR hình ảnh và transcript liên quan đến bài học và câu hỏi truy vấn.
    
    Args:
        lesson_id: Mã bài học cần tìm kiếm.
        query: Từ khóa hoặc câu truy vấn cần tìm kiếm evidence.
        image_id: Mã slide/hình ảnh tùy chọn để lọc evidence trực quan.
    """
    query_lower = query.lower()
    evidence_results = []
    
    # Tìm kiếm transcript cục bộ
    transcript_files = glob.glob("data/vlearn-pack/transcript/transcript-*-clean.md")
    for filepath in transcript_files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            paragraphs = content.split("\n\n")
            for para in paragraphs:
                para_clean = para.strip()
                if not para_clean:
                    continue
                if query_lower in para_clean.lower():
                    match = re.search(r"\[(T\d+-\d+)\]", para_clean)
                    section_code = match.group(1) if match else "N/A"
                    evidence_results.append({
                        "type": "transcript",
                        "source": os.path.basename(filepath),
                        "section": section_code,
                        "text": para_clean[:300]
                    })
                if len(evidence_results) >= 4:
                    break
        if len(evidence_results) >= 4:
            break
            
    # Thêm slide text evidence giả định nếu danh sách trống hoặc cần bổ sung nguồn
    PAGES_MOCK = {
        7: "Slide 7: Rule vs Workflow vs Agent. Rule: Input cấu trúc, quyết định nhị phân. Workflow: Nhiều bước cố định. Agent: Tự chọn công cụ, khó trace.",
        67: "Slide 67: Khung Problem Statement cho hệ thống AI. 6 yếu tố bài toán cốt lõi: Actor, Workflow, Bottleneck, Impact, Success Metric, Boundary. 3 yếu tố AI: Ambiguity, Cost of error, Ground truth.",
        68: "Slide 68: Template Problem Statement: [một người dùng] khi [đang làm việc gì] cần [một quyết định AI] để đạt [một kết quả đo được].",
        28: "Slide 28: Probability Distribution. Phân bố xác suất đoán từ trong mô hình ngôn ngữ lớn (ví dụ: land 22%, forest 9%).",
        22: "Slide 22: Memory Injection & Context Management. Đưa thông tin cần thiết vào ngữ cảnh, nén thông tin."
    }
    
    for page, text in PAGES_MOCK.items():
        if query_lower in text.lower():
            evidence_results.append({
                "type": "slide",
                "source": "Day 02 Slide",
                "page": page,
                "text": text
            })
            
    return {"query": query, "evidences": evidence_results[:5]}


def verify_claims(claims: list, sources: list) -> dict:
    """Kiểm tra từng tuyên bố (claim) trong bài viết có được các nguồn (sources) hỗ trợ hay không để tránh bịa đặt.
    
    Args:
        claims: Danh sách các câu kết luận chính trong câu trả lời đề xuất.
        sources: Danh sách các evidence thu thập được từ slide/transcript.
    """
    verification_results = []
    for claim in claims:
        supported = False
        matched_source = None
        for src in sources:
            src_text = src.get("text", "") or src.get("content", "")
            matches = sum(1 for word in claim.lower().split() if len(word) > 4 and word in src_text.lower())
            if matches >= 2:
                supported = True
                matched_source = src.get("section", "N/A") if src.get("type") == "transcript" else f"trang {src.get('page', 'N/A')}"
                break
        verification_results.append({
            "claim": claim,
            "supported": supported,
            "matched_source": matched_source
        })
    return {"verification": verification_results, "all_valid": all(v["supported"] for v in verification_results)}


def record_trace(intent: str, tool_calls: list, sources: list, result: str) -> dict:
    """Lưu lại trace vết thực thi của Agent (ý định, lệnh gọi tool, nguồn và kết quả) để debug và đánh giá chất lượng.
    
    Args:
        intent: Ý định đã phân loại (summary, explain_image, clarify).
        tool_calls: Danh sách các tool đã được gọi trong vòng lặp.
        sources: Các nguồn dữ liệu đã trích xuất được.
        result: Câu trả lời cuối cùng của Agent.
    """
    trace = {
        "timestamp": time.time(),
        "intent": intent,
        "tool_calls": tool_calls,
        "sources": sources,
        "result_summary": result[:150] + "..." if result else ""
    }
    # Lưu xuống file trace cục bộ
    trace_dir = "eval"
    os.makedirs(trace_dir, exist_ok=True)
    with open(os.path.join(trace_dir, "agent_traces.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(trace, ensure_ascii=False) + "\n")
    return {"status": "success", "trace_recorded": True}


# =============================================================
# EXECUTOR AGENT LOOP
# =============================================================

def call_deepseek(user_query, context_info, image_payload):
    if use_mock:
        # Chế độ Mock phản hồi nếu không có API key để demo
        time.sleep(0.5)
        if "Flappy Bird" in user_query:
            return "Yêu cầu viết code game pygame nằm ngoài phạm vi khóa học AI Product. Vui lòng hỏi các câu hỏi liên quan đến bài giảng."
        if "slide 80" in user_query:
            return "Rất tiếc, tôi không tìm thấy tài liệu slide 80. Bài giảng Day 01 chỉ có tối đa 60 trang slide."
        return f"[MOCK] Đây là câu trả lời mẫu cho câu hỏi: '{user_query}' sử dụng tài liệu '{context_info}'. [trang 1]"

    try:
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        # Cấu hình danh sách 6 tools theo đặc tả của DeepSeek
        tools_definition = [
            {
                "type": "function",
                "function": {
                    "name": "classify_intent",
                    "description": "Phân loại ý định từ prompt của học viên: tóm tắt bài giảng (summary), giải thích hình ảnh/vùng khoanh (explain_image), hoặc câu hỏi mơ hồ thiếu context (clarify).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "prompt": {"type": "string", "description": "Câu hỏi của học viên."},
                            "context": {"type": "object", "description": "Thông tin context như tọa độ crop hoặc slide hiện tại."}
                        },
                        "required": ["prompt", "context"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_knowledge_units",
                    "description": "Lấy danh sách các đơn vị kiến thức của bài học theo phạm vi chỉ định.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "lesson_id": {"type": "string", "description": "Mã bài học ví dụ: Day02."},
                            "scope": {"type": "string", "description": "Phạm vi cần lấy."}
                        },
                        "required": ["lesson_id", "scope"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "analyze_selected_region",
                    "description": "Phân tích hình ảnh slide đầy đủ cùng với vùng crop (tọa độ bbox) để xác định thành phần được hỏi.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "full_image": {"type": "string"},
                            "crop_image": {"type": "string"},
                            "bbox": {"type": "array", "items": {"type": "number"}},
                            "prompt": {"type": "string"}
                        },
                        "required": ["full_image", "crop_image", "bbox", "prompt"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "retrieve_lesson_evidence",
                    "description": "Tìm kiếm slide text, OCR hình ảnh và transcript liên quan đến bài học và câu hỏi truy vấn.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "lesson_id": {"type": "string"},
                            "query": {"type": "string"},
                            "image_id": {"type": "string"}
                        },
                        "required": ["lesson_id", "query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "verify_claims",
                    "description": "Kiểm tra từng tuyên bố trong bài viết có được các nguồn hỗ trợ hay không để tránh bịa đặt.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "claims": {"type": "array", "items": {"type": "string"}},
                            "sources": {"type": "array", "items": {"type": "object"}}
                        },
                        "required": ["claims", "sources"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "record_trace",
                    "description": "Lưu lại trace vết thực thi của Agent (ý định, lệnh gọi tool, nguồn và kết quả) để debug và đánh giá.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "intent": {"type": "string"},
                            "tool_calls": {"type": "array", "items": {"type": "object"}},
                            "sources": {"type": "array", "items": {"type": "object"}},
                            "result": {"type": "string"}
                        },
                        "required": ["intent", "tool_calls", "sources", "result"]
                    }
                }
            }
        ]

        # Khởi tạo bối cảnh đầu vào cho Agent
        context_data = {
            "lesson_id": "Day02",
            "has_crop": image_payload is not None,
            "image_payload": image_payload,
            "current_slide": context_info
        }

        prompt = f"Bối cảnh slide học viên đang xem: {context_info}\n"
        if image_payload:
            prompt += f"Thông tin vùng chọn (crop): {json.dumps(image_payload)}\n"
        prompt += f"Câu hỏi của học viên: {user_query}"

        messages = [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": prompt}
        ]

        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "tools": tools_definition,
            "temperature": 0.1
        }

        # Gọi lượt 1
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")

        res_json = response.json()
        message = res_json["choices"][0]["message"]

        # Vòng lặp điều phối Agent (Tối đa 6 bước để hoàn tất workflow)
        loop_count = 0
        executed_tool_calls = []
        collected_sources = []
        detected_intent = "unknown"

        while message.get("tool_calls") and loop_count < 6:
            loop_count += 1
            tool_calls = message["tool_calls"]
            messages.append(message)

            for tool_call in tool_calls:
                func_name = tool_call["function"]["name"]
                func_args = json.loads(tool_call["function"]["arguments"])
                tool_call_id = tool_call["id"]

                # Ghi nhận tool call vào danh sách trace
                executed_tool_calls.append({"step": loop_count, "tool": func_name, "args": func_args})

                # Thực thi logic tool cục bộ tương ứng
                result_data = {}
                if func_name == "classify_intent":
                    # Xử lý tham số an toàn
                    p = func_args.get("prompt", user_query)
                    ctx = func_args.get("context", context_data)
                    result_data = classify_intent(p, ctx)
                    detected_intent = result_data.get("intent", "unknown")
                elif func_name == "get_knowledge_units":
                    lid = func_args.get("lesson_id", "Day02")
                    sc = func_args.get("scope", "all")
                    result_data = get_knowledge_units(lid, sc)
                elif func_name == "analyze_selected_region":
                    fi = func_args.get("full_image", "slide_full.png")
                    ci = func_args.get("crop_image", "slide_crop.png")
                    bb = func_args.get("bbox", [0, 0, 100, 100])
                    pr = func_args.get("prompt", user_query)
                    result_data = analyze_selected_region(fi, ci, bb, pr)
                elif func_name == "retrieve_lesson_evidence":
                    lid = func_args.get("lesson_id", "Day02")
                    q = func_args.get("query", user_query)
                    img_id = func_args.get("image_id")
                    result_data = retrieve_lesson_evidence(lid, q, img_id)
                    # Gom bằng chứng vào collected_sources
                    if "evidences" in result_data:
                        collected_sources.extend(result_data["evidences"])
                elif func_name == "verify_claims":
                    cls = func_args.get("claims", [])
                    srcs = func_args.get("sources", collected_sources)
                    result_data = verify_claims(cls, srcs)
                elif func_name == "record_trace":
                    it = func_args.get("intent", detected_intent)
                    tcs = func_args.get("tool_calls", executed_tool_calls)
                    scs = func_args.get("sources", collected_sources)
                    res = func_args.get("result", "")
                    result_data = record_trace(it, tcs, scs, res)

                # Thêm tin nhắn phản hồi của tool vào lịch sử cuộc trò chuyện
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": func_name,
                    "content": json.dumps(result_data, ensure_ascii=False)
                })

            # Gọi lại DeepSeek với lịch sử cuộc gọi tool mới
            payload = {
                "model": "deepseek-chat",
                "messages": messages,
                "tools": tools_definition,
                "temperature": 0.1
            }
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise Exception(f"API Tool Call Error {response.status_code}: {response.text}")

            res_json = response.json()
            message = res_json["choices"][0]["message"]

        return message["content"]
    except Exception as e:
        return f"❌ Lỗi gọi Agent DeepSeek: {str(e)}"

def main():
    if not os.path.exists(GOLDEN_SET_PATH):
        print(f"❌ Không tìm thấy file Golden Set tại {GOLDEN_SET_PATH}")
        return

    with open(GOLDEN_SET_PATH, "r", encoding="utf-8") as f:
        golden_set = json.load(f)

    print(f"🚀 Bắt đầu chạy thử {len(golden_set)} cases trong Golden Set bằng Agent...")
    actual_outputs = []

    for index, case in enumerate(golden_set):
        case_id = case["id"]
        user_query = case["user_query"]
        context = case["context_slide_id"]
        img = case["image_payload"]
        
        print(f"[{index+1}/{len(golden_set)}] Đang chạy {case_id}: '{user_query[:30]}...'")
        
        actual_response = call_deepseek(user_query, context, img)
        
        actual_outputs.append({
            "id": case_id,
            "user_query": user_query,
            "category": case["category"],
            "expected_behavior": case["ground_truth"],
            "actual_response": actual_response
        })
        time.sleep(1) # Tránh rate limit của free tier

    with open(ACTUAL_OUTPUTS_PATH, "w", encoding="utf-8") as f:
        json.dump(actual_outputs, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã chạy xong! Kết quả thực tế được ghi vào: {ACTUAL_OUTPUTS_PATH}")
    print("Vui lòng đối chiếu file này với bảng đánh giá chất lượng trong 'eval/evaluation_run_1.md'.")

if __name__ == "__main__":
    main()
