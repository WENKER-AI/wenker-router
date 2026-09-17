# WENKER AI Provider Portal - Official

## 📍 Overview

Đây là **trang web nhà cung cấp chính thức** của WENKER AI, chứa toàn bộ model AI thật mà không cần cấu hình Base URL hay API Key.

## 🎯 Purpose

Trang web này hoạt động như một **nhà cung cấp gốc (origin provider)** cho WENKER Router. Khác với các provider khác yêu cầu cấu hình Base URL và API Key, trang web này:

- ✅ **Không yêu cầu Base URL** - Model được cung cấp trực tiếp
- ✅ **Không yêu cầu API Key** - Sử dụng miễn phí
- ✅ **Model thật** - Kết nối trực tiếp đến các nhà cung cấp AI
- ✅ **Nhà cung cấp gốc** - Dùng để cung cấp model cho WENKER Router

## 📁 Structure

```
web/
├── ads/          # Trang quảng cáo (gốc là thư mục web cũ)
│   ├── index.html
│   ├── landing.html
│   ├── 404.html
│   ├── assets/
│   │   ├── i18n/
│   │   ├── icons.js
│   │   ├── games.js
│   │   └── ...
│   ├── robots.txt
│   └── sitemap.xml
│
└── test/         # Trang nhà cung cấp chính (mới)
    ├── index.html     # Trang chính hiển thị models
    └── README.md      # Documentation
```

## 🚀 Features

### 1. **No Configuration Required**
- Không cần thiết lập Base URL
- Không cần nhập API Key
- Chỉ cần chọn model và sử dụng ngay

### 2. **Direct Provider Connection**
- Kết nối trực tiếp đến các nhà cung cấp AI hàng đầu:
  - OpenAI (GPT-4, GPT-4o, GPT-3.5)
  - Anthropic (Claude 3.5, Claude 3)
  - Google (Gemini 1.5)
  - Meta (Llama 3.1)
  - DeepSeek (DeepSeek R1)
  - Mistral AI
  - Và nhiều hơn nữa...

### 3. **Real-Time Model Access**
- Hiển thị danh sách models khả dụng
- Tìm kiếm models theo tên, provider, tags
- Xem chi tiết model (context, pricing, usage)
- Copy model ID dễ dàng

### 4. **Responsive Design**
- Hoạt động trên tất cả thiết bị (desktop, tablet, mobile)
- Giao diện dark mode thân thiện
- Hiệu ứng animation mượt mà

## 🌐 Access

Sau khi deploy:
- **Provider Portal**: `http://localhost:3600/web/test/`
- **ADS Portal**: `http://localhost:3600/web/ads/`

Hoặc có thể cấu hình routing:
- `/` → Provider Portal (test)
- `/ads/` → ADS Portal

## 🔧 Configuration

### 1. Update Server Routing

 Trong `server/index.ts`, thêm route cho `/web/test`:

```typescript
// Serve Provider Portal
app.use('/web/test', express.static(path.join(__dirname, '..', 'web', 'test')));

// Serve ADS Portal (đã có sẵn)
app.use('/web/ads', express.static(path.join(__dirname, '..', 'web', 'ads')));

// Redirect root to provider portal
app.get('/web', (req, res) => {
  res.redirect('/web/test/');
});
```

### 2. Update Navigation

Trong các file frontend, cập nhật link đến các portal:
- Provider Portal: `/web/test/`
- ADS Portal: `/web/ads/`

## 📊 Models Data

Hiện tại, danh sách models được hardcode trong `index.html`. Để quản lý dynamic, bạn có thể:

### Option 1: Fetch từ API

```javascript
// Thay thế phần models data trong index.html
async function fetchModels() {
  try {
    const response = await fetch('/api/models');
    const data = await response.json();
    return data.models || [];
  } catch (err) {
    console.error('Failed to fetch models:', err);
    return [];
  }
}

// Sử dụng
const models = await fetchModels();
renderModels(models);
```

### Option 2: JSON File

Tạo file `web/test/models.json`:

```json
[
  {
    "id": "gpt-4",
    "name": "GPT-4",
    "provider": "OpenAI",
    "type": "premium",
    "category": "Text",
    "description": "Model ngôn ngữ mạnh mẽ nhất của OpenAI",
    "context": 32768,
    "maxTokens": 8192,
    "price": "$0.03/1K tokens",
    "tags": ["text", "reasoning", "advanced"],
    "usage": "Chat, Coding, Reasoning",
    "endpoint": "/v1/chat/completions",
    "requiresAuth": false
  },
  {
    "id": "claude-3-5-sonnet",
    "name": "Claude 3.5 Sonnet",
    "provider": "Anthropic",
    "type": "premium",
    "category": "Text",
    "description": "Claude 3.5 với trí thông minh vượt trội",
    "context": 200000,
    "maxTokens": 4096,
    "price": "$0.003/1K tokens",
    "tags": ["text", "reasoning", "intelligent"],
    "usage": "Complex Tasks, Reasoning",
    "endpoint": "/v1/messages",
    "requiresAuth": false
  }
]
```

## 🎨 Customization

### 1. Thay đổi Theme

Trong `index.html`, sửa các biến CSS:

```css
:root {
    --bg-primary: #0b1221;      /* Màu nền chính */
    --bg-secondary: #0f172a;    /* Màu nền phụ */
    --bg-tertiary: #1e293b;     /* Màu nền cấp 3 */
    --text-primary: #eaf2ff;    /* Chữ chính */
    --text-secondary: #94a3b8;  /* Chữ phụ */
    --accent: #00d4ff;          /* Màu nhấn */
    --gradient: linear-gradient(135deg, #00d4ff 0%, #00a8c8 100%);
}
```

### 2. Thay đổi Logo & Branding

Sửa trong phần `<title>` và header:

```html
<title>WENKER AI - Nhà Cung Cấp Chính | Official Provider Portal</title>

<!-- Trong header -->
<a href="/" class="logo">
    <div class="logo-icon">W</div>
    <span class="logo-text">WENKER AI</span>
</a>
```

### 3. Thêm Custom Models

Thêm vào mảng `models` trong JavaScript:

```javascript
const models = [
    // ... models hiện có
    {
        id: 'your-model-id',
        name: 'Your Model Name',
        provider: 'Your Provider',
        type: 'free', // or 'standard', 'premium'
        category: 'Text', // or 'Multimodal', 'Image', 'Audio'
        description: 'Model description',
        context: 8192,
        maxTokens: 4096,
        price: 'Free',
        tags: ['ai', 'model', 'custom'],
        usage: 'General chat',
        example: 'Hello, I am your custom model...'
    }
];
```

## 🔐 Security Considerations

### 1. Rate Limiting

Trang web này không có rate limiting riêng. Để bảo vệ, hãy:

- Sử dụng rate limiter trong server
- Giới hạn request đến `/web/test/`

### 2. Authentication (Optional)

Nếu muốn bảo vệ trang provider portal:

```typescript
// Trong server/index.ts
app.use('/web/test', (req, res, next) => {
    // Kiểm tra API key hoặc session
    const auth = req.headers['x-wenker-key'] || req.headers['authorization'];
    if (!auth) {
        return res.redirect('/login');
    }
    next();
});
```

### 3. CORS

Đảm bảo CORS được cấu hình đúng:

```typescript
app.use(cors({
    origin: ['http://localhost:3600', 'https://your-domain.com'],
    methods: ['GET', 'POST'],
    credentials: true
}));
```

## 📈 Analytics & Monitoring

### 1. Track Page Views

Thêm Google Analytics hoặc các công cụ tracking khác:

```html
<!-- Trong <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### 2. Error Tracking

Sử dụng Sentry hoặc các công cụ tương tự:

```html
<script src="https://browser.sentry-cdn.com/7.0.0/bundle.min.js"></script>
<script>
  Sentry.init({ dsn: 'YOUR_DSN' });
</script>
```

## 🚀 Deployment

### 1. Local Development

```bash
# Start WENKER Router
npm start

# Truy cập Provider Portal
# http://localhost:3600/web/test/
```

### 2. Production Deployment

#### Option A: Static Hosting

Đặt thư mục `web/test` lên bất kỳ static hosting service nào:
- Netlify
- Vercel
- GitHub Pages
- AWS S3
- Cloudflare Pages

#### Option B: Integrated with WENKER Router

WENKER Router đã được cấu hình sẵn để serve static files từ `web/`:

```typescript
// Đã có sẵn trong server/index.ts
app.use('/web', express.static(path.join(__dirname, '..', 'web')));
```

Chỉ cần đảm bảo thư mục `web/test` tồn tại.

## 🎯 Integration with WENKER Router

Để WENKER Router có thể sử dụng models từ Provider Portal:

### 1. Cấu hình trong dbService

Thêm provider mới trong `server/config/providers-data.js`:

```javascript
{
    id: 'wenker-test',
    name: 'WENKER Test Provider',
    baseUrl: 'http://localhost:3600/web/test/api',
    requiresAuth: false,
    authType: 'none',
    isFree: true,
    category: 'test',
    models: [
        { id: 'gpt-4', name: 'GPT-4', targetModel: 'gpt-4' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', targetModel: 'claude-3-5-sonnet' },
        // ...
    ]
}
```

### 2. Proxy API

Tạo API proxy trong `web/test/api/`:

```javascript
// web/test/api/chat/completions
const express = require('express');
const router = express.Router();
const proxyService = require('../../../server/services/proxyService');

router.post('/chat/completions', async (req, res) => {
    // Forward request đến provider thật
    await proxyService.handleChatCompletion(req, res);
});

module.exports = router;
```

## 📚 API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/web/test/` | Trang chính hiển thị models |
| GET | `/web/test/models` | Lấy danh sách models (JSON) |
| GET | `/web/test/models/{id}` | Lấy chi tiết model |

### Request Examples

```bash
# Lấy danh sách models
curl http://localhost:3600/web/test/models

# Lấy chi tiết model
curl http://localhost:3600/web/test/models/gpt-4
```

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-09-17 | Initial release |

## 📖 License

MIT License - See [LICENSE](../../LICENSE) for details.

## 🙏 Contributing

Đóng góp vào project bằng cách:
1. Fork repository
2. Tạo branch mới (`git checkout -b feature/your-feature`)
3. Commit thay đổi (`git commit -m 'Add your feature'`)
4. Push đến branch (`git push origin feature/your-feature`)
5. Tạo Pull Request

## 📞 Support

- **Website**: https://wenker.ai
- **GitHub**: https://github.com/WENKER-AI/wenker-router
- **Email**: support@wenker.ai
- **Community**: https://community.wenker.ai

---

*Generated by Mistral Vibe - 2026-09-17*
