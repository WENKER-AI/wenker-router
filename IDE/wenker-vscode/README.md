# WENKER - VS Code model provider

Đưa **toàn bộ model của WENKER Router** (`http://localhost:3600`) vào thẳng danh sách
model của VS Code: Chat, Copilot Edit, Agent, và mọi đối tác dùng bộ chọn model.
Đây là cách làm "hướng B": không tự chế lại một cái IDE, mà bám vào API chính thức
của VS Code để nó trở thành một nhà cung cấp model thật.

## Chạy được là có model liền

1. Khởi động router: `start.bat` hoặc `node server/index.js`.
2. Cài extension này (file `.vsix`).
3. Mở Chat panel → bấm bộ chọn model → nhóm **WENKER (local router)**.

Không cần khai báo gì thêm. Mặc định extension chỉ hiện **model miễn phí không cần
API key**, tức là chọn là chạy được ngay.

## Cài đặt từ file .vsix

```
code --install-extension wenker-0.1.1.vsix --force
```

Hoặc trong VS Code: `Ctrl+Shift+P` → **Extensions: Install from VSIX...**

### Tự kiểm tra: VS Code có thật sự thấy model?

`Ctrl+Shift+P` → **WENKER: Tự kiểm — VS Code đang thấy bao nhiêu model?**
Lệnh này gọi `vscode.lm.selectChatModels({vendor:"wenker"})` — tức hỏi **chính VS Code**
chứ không phải extension tự báo — rồi mở một bảng markdown liệt kê từng id mà bộ chọn
model nhận được. Nếu số id < số model extension sinh ra, nghĩa là VS Code đang bỏ qua
model vì trùng identifier.

## Cấu hình

| Setting | Mặc định | Ý nghĩa |
|---|---|---|
| `wenker.baseUrl` | `http://localhost:3600/v1` | Base URL của router. Đổi khi chạy ở cổng/máy khác. |
| `wenker.modelFilter` | `free` | `no-key` = chỉ model không đòi API key · `free` = mọi model miễn phí · `all` = toàn bộ |
| `wenker.maxOutputTokens` | `4096` | Số token ra tối đa khai báo với VS Code |
| `wenker.maxInputTokensCap` | `128000` | Trần ngữ cảnh được dùng trong VS Code (xem ghi chú dưới) |
| `wenker.requestTimeoutMs` | `120000` | Thời gian chờ tối đa mỗi request |
| `wenker.adminKey` | `""` | API key role admin, chỉ cần khi dùng lệnh quản trị từ máy khác |

### Về `maxInputTokensCap`

Một vài nguồn free khai báo ngữ cảnh tới **1.000.000 token** (ví dụ
`wenker-gemini-2.5-free`), nhưng thực tế nhiều nguồn trong số đó không phục vụ nổi
tới mức đó. VS Code dùng `maxInputTokens` để quyết định cắt lịch sử chat, nên khai
báo quá rộng sẽ khiến nội dung bị mất **im lặng, không báo lỗi**. Vì vậy extension
trần giá trị theo `maxInputTokensCap` (mặc định 128K) và ghi rõ trong tooltip nếu
router khai báo lớn hơn. Tăng lên khi bạn chắc chắn nguồn đó dùng được thật.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `WENKER: Tải lại danh sách model` | Gọi lại `/v1/models`, báo cho VS Code vẽ danh sách mới |
| `WENKER: Kiểm tra kết nối + định tuyến` | Mở bảng báo cáo: server còn sống không, bao nhiêu model, nhóm nào không cần key, nguồn nào đang sống theo probe |
| `WENKER: Cài một file .addon` | Chọn file `.addon` → gọi `POST /api/addons/install` |
| `WENKER: Liệt kê add-on đang cài` | Mở bảng add-on đang có trên router |
| `WENKER: Mở dashboard + Playground` | Mở `http://localhost:3600` trong trình duyệt |
| `WENKER: Tự kiểm — VS Code đang thấy bao nhiêu model?` | Hỏi thẳng `vscode.lm.selectChatModels()` rồi mở bảng id, dùng để phát hiện model bị VS Code âm thầm bỏ qua |

## Cách hoạt động (và vì sao không cần cấu hình)

Extension không lưu danh sách model tĩnh. Mỗi lần VS Code hỏi, nó gọi
`GET /v1/models` của router rồi lọc theo `modelFilter`. Router thêm provider hay
model nào thì bên này thấy ngay, chỉ cần chạy `Tải lại danh sách model`.

Nó dùng `vscode.lm.registerLanguageModelChatProvider` + contribution point
`languageModelChatProviders` — API **ổn định**, không phải proposed API, nên không
cần bật cơ chế thích nghi hoá nào.

## Giới hạn thật (không nói thêm)

- **Nguồn free ẩn danh hết budget**: pollinations (nhóm `wenker-*`) trả
  `402 Payment Required` / "reached its budget" khi hết lượt. Đó là giới hạn của
  upstream, không phải lỗi extension. Dùng `WENKER: Kiểm tra kết nối` để tìm nguồn
  đang sống, hoặc tự thêm key miễn phí cho Groq/Gemini/OpenRouter... qua dashboard
  rồi đổi `modelFilter` sang `all`.
- **Không hỗ trợ ảnh và tool calling**: `capabilities.imageInput` và `toolCalling`
  cố định bằng `false`, vì router không bảo đảm function-calling hoàn chỉnh cho
  181 nguồn khác nhau. Khai báo `true` sẽ khiến VS Code gửi định dạng mà upstream
  không đọc được.
- **Ước lượng token không chính xác**: `provideTokenCount` dùng xấp xỉ 4 ký
  tự/token. Router không chạy tokenizer riêng của từng upstream.
- **Cài add-on từ xa cần admin key**: từ máy local thì guard cho qua; từ máy khác
  phải gửi `x-wenker-admin-key` (extension tự hỏi khi cần).

## Vì sao một số model có tên dạng `provider/ten-model`

VS Code định danh mỗi model bằng chuỗi `vendor/id` (hoặc `vendor/nhom/id`) và
**bỏ qua im lặng** model nào có identifier trùng với model đã đăng ký trước đó —
log cửa sổ in ra `[LM] Model wenker/default is already registered. Skipping.`.

Router lại có tới 6 provider local (vllm, sglang, aphrodite, xinference,
openwebui-proxy, openllm/llamacpp) cùng đặt tên model là `default`. Nếu giữ nguyên
tên trần thì 6 model chỉ còn 1 xuất hiện trong bộ chọn. Do đó extension tự động
đổi tên những model bị trùng thành `provider/id`, ví dụ `llamacpp/default`.

Hai điểm cần nói thẳng:

- Router chấp nhận tên định danh dạng `provider/id` (`POST /v1/chat/completions`
  trả 200 với `wenker-cloud/wenker-deepseek-r1-free`).
- Nhóm `*/default` chỉ **có mặt trong danh sách** cho đủ; gọi thật sẽ thất bại nếu
  bạn chưa chạy runtime đó ở `localhost:8000/4000/...`. Đó là sự thật, không phải
  lỗi định tuyến.
