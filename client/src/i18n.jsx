import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// i18n tối giản cho dashboard: vi / en / zh / fr.
// Ngôn ngữ tự động theo trình duyệt (navigator.language), lưu localStorage,
// và có thể đổi bất cứ lúc nào bằng nút globe trên Navbar.

const STORAGE_KEY = 'wenker.ui.lang';
export const LANGS = ['vi', 'en', 'zh', 'fr'];
export const LANG_NAMES = { vi: 'Tiếng Việt', en: 'English', zh: '中文', fr: 'Français' };

const STRINGS = {
  // ---------- Navbar ----------
  'nav.dashboard': { vi: 'Tổng Quan', en: 'Overview', zh: '总览', fr: 'Vue d\u2019ensemble' },
  'nav.playground': { vi: 'Playground Miễn Phí', en: 'Free Playground', zh: '免费试玩', fr: 'Bac \u00e0 sable gratuit' },
  'nav.finder': { vi: 'Model Finder', en: 'Model Finder', zh: '模型查找', fr: 'Model Finder' },
  'nav.providers': { vi: 'Nhà Cung Cấp', en: 'Providers', zh: '服务商', fr: 'Fournisseurs' },
  'nav.routing': { vi: 'Định Tuyến & Fallback', en: 'Routing & Fallback', zh: '路由与回退', fr: 'Routage & repli' },
  'nav.addons': { vi: 'Kho Add-on', en: 'Add-on Store', zh: '插件库', fr: 'Catalogue d\u2019extensions' },
  'nav.keys': { vi: 'API Keys', en: 'API Keys', zh: 'API 密钥', fr: 'Clés API' },
  'nav.logs': { vi: 'Nhật Ký (Logs)', en: 'Logs', zh: '日志', fr: 'Journaux' },
  'nav.settings': { vi: 'Cài Đặt', en: 'Settings', zh: '设置', fr: 'Param\u00e8tres' },
  'nav.copyBase': { vi: 'Sao chép Base URL', en: 'Copy Base URL', zh: '复制 Base URL', fr: 'Copier l\u2019URL de base' },
  'nav.logout': { vi: 'Đăng xuất', en: 'Sign out', zh: '退出登录', fr: 'Se d\u00e9connecter' },
  'nav.user': { vi: 'Người dùng', en: 'User', zh: '用户', fr: 'Utilisateur' },
  'nav.quotaOut': { vi: 'hết lượt', en: 'quota out', zh: '今日已用完', fr: 'quota \u00e9puis\u00e9' },
  'nav.lang': { vi: 'Ngôn ngữ', en: 'Language', zh: '语言', fr: 'Langue' },
  'nav.tagline': { vi: 'Cổng proxy AI cục bộ', en: 'Local AI proxy gateway', zh: '本地 AI 代理网关', fr: 'Passerelle proxy IA locale' },

  // ---------- App ----------
  'app.checking': { vi: 'Đang kiểm tra phiên...', en: 'Checking session...', zh: '正在检查会话...', fr: 'V\u00e9rification de la session...' },
  'app.footerOpen': { vi: 'Mã nguồn mở chạy Local', en: 'Open-source, runs locally', zh: '本地运行的开源项目', fr: 'Open source, ex\u00e9cut\u00e9 en local' },

  // ---------- Dashboard ----------
  'dash.title': { vi: 'Cổng Định Tuyến AI 180+ Nhà Cung Cấp', en: 'AI Routing Gateway with 180+ Providers', zh: '180+ 服务商 AI 路由网关', fr: 'Passerelle de routage IA \u2014 180+ fournisseurs' },
  'dash.sub': {
    vi: 'Tích hợp sẵn WENKER Cloud định tuyến tới các tier miễn phí của nhà cung cấp bên thứ ba (có giới hạn hạn mức, nguồn cần key vẫn cần key của bạn). Tương thích hoàn hảo chuẩn OpenAI & Anthropic Claude cho Claude Code, Cursor, Cline, OpenWebUI.',
    en: 'WENKER Cloud is built in and routes to third-party free tiers (quota-limited; sources that need a key still need yours). Fully compatible with the OpenAI & Anthropic Claude APIs for Claude Code, Cursor, Cline, OpenWebUI.',
    zh: '内置 WENKER Cloud，可路由到第三方免费额度（有限额；需要密钥的来源仍需你自己的密钥）。完全兼容 OpenAI 与 Anthropic Claude 接口，适用于 Claude Code、Cursor、Cline、OpenWebUI。',
    fr: 'WENKER Cloud int\u00e9gr\u00e9 : routage vers les offres gratuites des fournisseurs tiers (quotas limit\u00e9s ; une source exigeant une cl\u00e9 n\u00e9cessite toujours la v\u00f4tre). Compatibilit\u00e9 totale avec les API OpenAI et Anthropic Claude pour Claude Code, Cursor, Cline, OpenWebUI.',
  },
  'dash.btnTry': { vi: 'Chạy Thử Miễn Phí', en: 'Try it free', zh: '免费试用', fr: 'Essayer gratuitement' },
  'dash.btnProviders': { vi: 'Xem 180+ Providers', en: 'View 180+ providers', zh: '查看 180+ 服务商', fr: 'Voir les 180+ fournisseurs' },
  'dash.statProviders': { vi: 'Tổng Số Provider', en: 'Total providers', zh: '服务商总数', fr: 'Fournisseurs au total' },
  'dash.statActive': { vi: 'Đang hoạt động', en: 'Active', zh: '活跃中', fr: 'Actifs' },
  'dash.statFree': { vi: 'Providers Miễn Phí', en: 'Free providers', zh: '免费服务商', fr: 'Fournisseurs gratuits' },
  'dash.statFreeSub': { vi: 'Tier ẩn danh, có giới hạn hạn mức', en: 'Anonymous tier, quota-limited', zh: '匿名额度，有限制', fr: 'Palier anonyme, quota limit\u00e9' },
  'dash.statRequests': { vi: 'Tổng Yêu Cầu (Requests)', en: 'Total requests', zh: '请求总数', fr: 'Requ\u00eates au total' },
  'dash.statSuccess': { vi: 'Tỉ lệ thành công', en: 'Success rate', zh: '成功率', fr: 'Taux de r\u00e9ussite' },
  'dash.statLatency': { vi: 'Độ Trễ Trung Bình', en: 'Average latency', zh: '平均延迟', fr: 'Latence moyenne' },
  'dash.noData': { vi: 'chưa có dữ liệu', en: 'no data yet', zh: '暂无数据', fr: 'pas encore de donn\u00e9es' },
  'dash.measuredFrom': { vi: 'Đo từ', en: 'Measured from', zh: '测量自', fr: 'Mesur\u00e9 sur' },
  'dash.requestsUnit': { vi: 'yêu cầu thực tế', en: 'real requests', zh: '个真实请求', fr: 'requ\u00eates r\u00e9elles' },
  'dash.quickSetup': { vi: 'Kết Nối 1-Click Cho Công Cụ Lập Trình', en: 'One-Click Connect for Dev Tools', zh: '开发工具一键接入', fr: 'Connexion 1-clic pour outils de dev' },
  'dash.quickSetupSub': { vi: 'Sao chép thông tin để kết nối Claude Code, Cursor, Cline và các ứng dụng AI khác.', en: 'Copy the details to connect Claude Code, Cursor, Cline and other AI apps.', zh: '复制信息即可连接 Claude Code、Cursor、Cline 及其他 AI 应用。', fr: 'Copiez les informations pour connecter Claude Code, Cursor, Cline et autres apps IA.' },
  'dash.copied': { vi: 'Đã chép', en: 'Copied', zh: '已复制', fr: 'Copi\u00e9' },
  'dash.copy': { vi: 'Sao chép', en: 'Copy', zh: '复制', fr: 'Copier' },
  'dash.cloudQueue': { vi: 'Hàng Đợi WENKER Cloud Miễn Phí', en: 'Free WENKER Cloud Queue', zh: 'WENKER Cloud 免费队列', fr: 'File d\u2019attente gratuite WENKER Cloud' },
  'dash.cloudQueueSub': { vi: 'Các model dưới đây được định tuyến sang tier miễn phí của nhà cung cấp bên thứ ba. Nguồn ẩn danh không cần key, nhưng vẫn có giới hạn hạn mức và có thể báo lỗi thật khi hết quota.', en: 'The models below route to third-party free tiers. Anonymous sources need no key, but quotas still apply and real errors may appear when they run out.', zh: '以下模型路由到第三方免费额度。匿名来源无需密钥，但仍有限额，用尽时会返回真实错误。', fr: 'Les mod\u00e8les ci-dessous sont rout\u00e9s vers les paliers gratuits tiers. Les sources anonymes ne n\u00e9cessitent pas de cl\u00e9, mais les quotas s\u2019appliquent et de vraies erreurs peuvent appara\u00eetre une fois \u00e9puis\u00e9s.' },
  'dash.m1': { vi: 'Yêu cầu deepseek-r1. Nếu tier ẩn danh không còn model này, router tự chuyển sang model khả dụng.', en: 'Requests deepseek-r1. If the anonymous tier no longer serves it, the router switches to an available model.', zh: '请求 deepseek-r1。若匿名额度不再有该模型，路由器自动切换到可用模型。', fr: 'Demande deepseek-r1. Si le palier anonyme ne le sert plus, le routeur bascule sur un mod\u00e8le disponible.' },
  'dash.m2': { vi: 'Yêu cầu qwen-coder cho tác vụ code, kèm ước lượng token từ nội dung thật.', en: 'Requests qwen-coder for coding tasks, with a token estimate from the real content.', zh: '请求 qwen-coder 处理代码任务，并根据真实内容估算 token。', fr: 'Demande qwen-coder pour le code, avec estimation des tokens à partir du contenu réel.' },
  'dash.m3': { vi: 'Yêu cầu llama. Model thực sự trả lời được ghi trong cột "resolvedModel" của Nhật Ký.', en: 'Requests llama. The model that actually answered is recorded in the "resolvedModel" column of the Logs.', zh: '请求 llama。实际作答的模型记录在日志的 "resolvedModel" 列。', fr: 'Demande llama. Le modèle ayant réellement répondu est noté dans la colonne « resolvedModel » des journaux.' },
  'dash.honestNote': { vi: 'Lưu ý trung thực: tier ẩn danh của nguồn miễn phí hiện chỉ phục vụ openai-fast (GPT-OSS 20B) và có thể báo lỗi 402 khi hết hạn mức. Khi đó router trả về lỗi 502 thật, không tạo nội dung mô phỏng. Muốn dùng đúng DeepSeek / Qwen / Llama như tên model, hãy nhập API key của provider đó trong tab "Nhà Cung Cấp".', en: 'Honesty note: the anonymous free-tier currently serves only openai-fast (GPT-OSS 20B) and may return 402 when the quota runs out. The router then returns a real 502 error — no simulated content. To actually use DeepSeek / Qwen / Llama as the model names imply, add that provider’s API key in the Providers tab.', zh: '诚实提示：匿名免费额度目前仅提供 openai-fast（GPT-OSS 20B），额度耗尽时可能返回 402。此时路由器返回真实 502 错误，绝不模拟内容。若想真正使用 DeepSeek / Qwen / Llama，请在“服务商”页填入对应 API 密钥。', fr: 'Note de transparence : le palier anonyme gratuit ne sert actuellement que openai-fast (GPT-OSS 20B) et peut renvoyer 402 quand le quota épuise. Le routeur renvoie alors une vraie erreur 502, sans contenu simulé. Pour utiliser réellement DeepSeek / Qwen / Llama, ajoutez la clé API du fournisseur dans l’onglet Fournisseurs.' },

  // ---------- Model Finder ----------
  'finder.title': { vi: 'Model Finder', en: 'Model Finder', zh: '模型查找', fr: 'Model Finder' },
  'finder.sub': {
    vi: 'Mô tả việc cần làm, WENKER tự chọn provider/model khớp nhất — đọc trực tiếp từ localhost nên có model mới là biết ngay.',
    en: 'Describe your task and WENKER picks the best-matching provider/model \u2014 read live from localhost, so new models show up instantly.',
    zh: '描述你的任务，WENKER 自动挑选最匹配的 provider/model——直接读取 localhost，新模型立即可见。',
    fr: 'D\u00e9crivez votre t\u00e2che et WENKER choisit le provider/mod\u00e8le le plus adapt\u00e9 \u2014 lu en direct depuis localhost, les nouveaux mod\u00e8les apparaissent aussit\u00f4t.',
  },

  // ---------- Providers ----------
  'prov.title': { vi: 'Danh Mục Nhà Cung Cấp AI', en: 'AI Provider Catalog', zh: 'AI 服务商目录', fr: 'Catalogue des fournisseurs IA' },
  'prov.sub': {
    vi: 'Quản lý Base URL, API Key, Cookie và kiểm tra độ trễ mạng cho hơn 180+ nhà cung cấp AI toàn cầu.',
    en: 'Manage Base URL, API key, cookies and network latency for 180+ AI providers worldwide.',
    zh: '管理全球 180+ AI 服务商的 Base URL、API 密钥、Cookie 与网络延迟。',
    fr: 'G\u00e9rez URL de base, cl\u00e9 API, cookies et latence r\u00e9seau pour plus de 180 fournisseurs IA.',
  },

  // ---------- Routing ----------
  'route.title': { vi: 'Định Tuyến & Dự Phòng Mô Hình (Smart Router)', en: 'Model Routing & Failover (Smart Router)', zh: '模型路由与故障转移（智能路由）', fr: 'Routage et repli des mod\u00e8les (Smart Router)' },
  'route.sub': {
    vi: 'Thiết lập ánh xạ bí danh (Model Aliasing) và chuỗi dự phòng tự động (Failover) khi nhà cung cấp chính gặp sự cố.',
    en: 'Set up model aliasing and automatic failover chains when the primary provider has an incident.',
    zh: '配置模型别名映射，以及主服务商故障时的自动回退链。',
    fr: 'Configurez l\u2019alias de mod\u00e8le et les cha\u00eenes de repli automatiques quand le fournisseur principal tombe.',
  },

  // ---------- Keys ----------
  'keys.title': { vi: 'Quản Lý WENKER API Keys', en: 'WENKER API Key Manager', zh: 'WENKER API 密钥管理', fr: 'Gestion des cl\u00e9s API WENKER' },
  'keys.sub': {
    vi: 'Tạo và quản lý các khóa API để kết nối Claude Code, Cursor, Cline, OpenWebUI và các dự án của bạn.',
    en: 'Create and manage API keys to connect Claude Code, Cursor, Cline, OpenWebUI and your projects.',
    zh: '创建并管理 API 密钥，连接 Claude Code、Cursor、Cline、OpenWebUI 及你的项目。',
    fr: 'Cr\u00e9ez et g\u00e9rez les cl\u00e9s API pour connecter Claude Code, Cursor, Cline, OpenWebUI et vos projets.',
  },

  // ---------- Logs ----------
  'logs.title': { vi: 'Nhật Ký Yêu Cầu (Live Request Logs)', en: 'Request Logs (Live)', zh: '请求日志（实时）', fr: 'Journaux des requ\u00eates (en direct)' },
  'logs.sub': {
    vi: 'Theo dõi thời gian thực tất cả các yêu cầu từ Claude Code, Cursor, Cline và Web Playground.',
    en: 'Watch every request from Claude Code, Cursor, Cline and the Web Playground in real time.',
    zh: '实时查看来自 Claude Code、Cursor、Cline 与网页 Playground 的所有请求。',
    fr: 'Suivez en direct toutes les requ\u00eates de Claude Code, Cursor, Cline et du Playground web.',
  },

  // ---------- Addons ----------
  'addon.title': { vi: 'Kho Add-on WENKER', en: 'WENKER Add-on Store', zh: 'WENKER 插件库', fr: 'Catalogue d\u2019extensions WENKER' },
  'addon.sub': {
    vi: 'File .addon là JSON đơn giản: 2 mẫu là ra theme cả hệ thống. Draft tay, tải file lên, hoặc nhờ AI viết hộ.',
    en: 'An .addon file is plain JSON: two templates are enough to theme the whole system. Hand-write it, upload a file, or let AI draft it.',
    zh: '.addon 文件就是简单 JSON：两个模板即可换掉整套主题。可手写、上传文件，或让 AI 代写。',
    fr: 'Un fichier .addon est du JSON simple : deux mod\u00e8les suffisent \u00e0 th\u00e9matiser tout le syst\u00e8me. \u00c9crivez-le \u00e0 la main, t\u00e9l\u00e9versez un fichier ou laissez l\u2019IA le r\u00e9diger.',
  },

  // ---------- Settings ----------
  'set.title': { vi: 'Cấu Hình Hệ Thống WENKER Router', en: 'WENKER Router System Settings', zh: 'WENKER Router 系统设置', fr: 'Param\u00e8tres syst\u00e8me WENKER Router' },
  'set.sub': {
    vi: 'Tinh chỉnh cổng máy chủ, cơ chế dự phòng tự động và hành vi mặc định của gateway.',
    en: 'Tune the server port, automatic failover behaviour and gateway defaults.',
    zh: '调整服务器端口、自动回退机制与网关默认行为。',
    fr: 'Ajustez le port du serveur, le comportement de repli automatique et les valeurs par d\u00e9faut.',
  },

  // ---------- Model badge ----------
  'model.servedBy': { vi: 'nguồn thật', en: 'real source', zh: '实际来源', fr: 'source r\u00e9elle' },
  // ---------- Playground ----------
  'pg.model': { vi: 'Model Miễn Phí:', en: 'Free model:', zh: '免费模型：', fr: 'Mod\\u00e8le gratuit :' },
  'pg.freeTier': { vi: 'Free tier • Có giới hạn hạn mức', en: 'Free tier \\u00b7 quota-limited', zh: '免费额度 \\u00b7 有限制', fr: 'Palier gratuit \\u00b7 quota limit\\u00e9' },
  'pg.latency': { vi: 'Độ trễ', en: 'Latency', zh: '延迟', fr: 'Latence' },
  'pg.params': { vi: 'Tham Số', en: 'Params', zh: '参数', fr: 'Param\\u00e8tres' },
  'pg.clear': { vi: 'Xóa Chat', en: 'Clear chat', zh: '清空对话', fr: 'Effacer' },
  'pg.clearTitle': { vi: 'Làm mới cuộc trò chuyện', en: 'Reset the conversation', zh: '重置对话', fr: 'R\\u00e9initialiser la conversation' },
  'pg.copyContent': { vi: 'Sao chép nội dung', en: 'Copy content', zh: '复制内容', fr: 'Copier le contenu' },
  'pg.generating': { vi: 'WENKER Cloud đang sinh phản hồi...', en: 'WENKER Cloud is generating a reply...', zh: 'WENKER Cloud 正在生成回复...', fr: 'WENKER Cloud g\\u00e9n\\u00e8re une r\\u00e9ponse...' },
  'pg.quotaToday': { vi: 'WENKER Cloud hôm nay: còn', en: 'WENKER Cloud today:', zh: '今日 WENKER Cloud：剩余', fr: 'WENKER Cloud aujourd\\u2019hui :' },
  'pg.quotaTurns': { vi: 'lượt', en: 'turns', zh: '次', fr: 'turns' },
  'pg.quotaAds': { vi: '(đã +{n} từ quảng cáo)', en: '(+{n} from ads)', zh: '（来自广告 +{n}）', fr: '(+{n} via publicit\\u00e9)' },
  'pg.inputPh': { vi: 'Nhập câu hỏi cho {model}... (Enter để gửi)', en: 'Ask {model}... (Enter to send)', zh: '向 {model} 提问…（回车发送）', fr: 'Interrogez {model}... (Entr\\u00e9e pour envoyer)' },
  'pg.send': { vi: 'Gửi', en: 'Send', zh: '发送', fr: 'Envoyer' },};

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) {
    /* private mode */
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'vi')
    .slice(0, 2)
    .toLowerCase();
  return LANGS.includes(nav) ? nav : 'vi';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const entry = STRINGS[key];
      let s = entry ? entry[lang] || entry.vi || key : key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
      return s;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
