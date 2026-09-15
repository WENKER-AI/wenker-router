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
  'addon.typeTheme': { vi: 'Giao diện', en: 'Interface', zh: '界面', fr: 'Interface' },
  'addon.typeProvider': { vi: 'Nhà cung cấp', en: 'Provider', zh: '服务商', fr: 'Fournisseur' },
  'addon.typeSnippet': { vi: 'Tính năng', en: 'Feature', zh: '功能', fr: 'Fonctionnalité' },
  'addon.installFail': { vi: 'Cài đặt thất bại.', en: 'Installation failed.', zh: '安装失败。', fr: 'Échec de l\u2019installation.' },
  'addon.installed': { vi: 'Đã cài "{name}" ({type}).', en: 'Installed "{name}" ({type}).', zh: '已安装「{name}」({type})。', fr: 'Installé « {name} » ({type}).' },
  'addon.netError': { vi: 'Lỗi mạng: {msg}', en: 'Network error: {msg}', zh: '网络错误：{msg}', fr: 'Erreur réseau : {msg}' },
  'addon.readFail': { vi: 'Đọc file thất bại.', en: 'Could not read the file.', zh: '读取文件失败。', fr: 'Lecture du fichier impossible.' },
  'addon.deleteFail': { vi: 'Không xóa được.', en: 'Could not delete.', zh: '无法删除。', fr: 'Suppression impossible.' },
  'addon.deleted': { vi: 'Đã gỡ bỏ add-on.', en: 'Add-on removed.', zh: '已移除插件。', fr: 'Extension supprimée.' },
  'addon.resetDefault': { vi: 'Về mặc định', en: 'Reset to default', zh: '恢复默认', fr: 'Réinitialiser' },
  'addon.usingDefault': { vi: 'đang dùng giao diện gốc', en: 'using the default theme', zh: '正在使用原始界面', fr: 'thème par défaut actif' },
  'addon.reload': { vi: 'Tải lại', en: 'Reload', zh: '重新加载', fr: 'Recharger' },
  'addon.installFileTitle': { vi: 'Cài add-on bằng file .addon', en: 'Install an add-on from a .addon file', zh: '通过 .addon 文件安装插件', fr: 'Installer une extension depuis un fichier .addon' },
  'addon.sampleBtn': { vi: 'Mẫu sample', en: 'Sample', zh: '示例', fr: 'Exemple' },
  'addon.uploadBtn': { vi: 'Tải file .addon', en: 'Upload .addon file', zh: '上传 .addon 文件', fr: 'Téléverser un fichier .addon' },
  'addon.sourcePh': { vi: 'Dán nội dung file .addon (JSON) vào đây...\nHoặc lưu file "theme.addon" rồi tải lên.', en: 'Paste the .addon file (JSON) content here...\nOr save a "theme.addon" file and upload it.', zh: '在此粘贴 .addon 文件（JSON）内容…\n或保存为 "theme.addon" 后上传。', fr: 'Collez ici le contenu du fichier .addon (JSON)...\nOu enregistrez un fichier "theme.addon" et téléversez-le.' },
  'addon.processing': { vi: 'Đang xử lý...', en: 'Processing...', zh: '处理中…', fr: 'Traitement...' },
  'addon.installBtn': { vi: 'Cài đặt add-on', en: 'Install add-on', zh: '安装插件', fr: 'Installer l\u2019extension' },
  'addon.theLoaiHint': { vi: 'thể loại: theme | provider | snippet — theme chỉ cần "accent" + "surface"', en: 'types: theme | provider | snippet — theme only needs "accent" + "surface"', zh: '类型：theme | provider | snippet —— theme 只需 "accent" + "surface"', fr: 'types : theme | provider | snippet — theme ne n\u00e9cessite que "accent" + "surface"' },
  'addon.tabAll': { vi: 'Tất cả', en: 'All', zh: '全部', fr: 'Tous' },
  'addon.emptyTitle': { vi: 'Chưa có add-on loại này.', en: 'No add-ons of this type yet.', zh: '尚无此类型插件。', fr: 'Aucune extension de ce type.' },
  'addon.emptySub': { vi: 'Viết một file .addon ở ô trên để thêm vào kho.', en: 'Write a .addon file above to add it to the store.', zh: '在上方编写 .addon 文件以添加到库。', fr: '\u00c9crivez un fichier .addon ci-dessus pour l\u2019ajouter.' },
  'addon.themeOn': { vi: 'Đang bật', en: 'Active', zh: '已启用', fr: 'Activé' },
  'addon.themeEnable': { vi: 'Bật theme', en: 'Enable theme', zh: '启用主题', fr: 'Activer le thème' },
  'addon.viewVars': { vi: 'Xem biến CSS', en: 'View CSS variables', zh: '查看 CSS 变量', fr: 'Voir les variables CSS' },
  'addon.providerNote': { vi: 'provider của bạn đã nằm trong /v1/models', en: 'your provider is now listed in /v1/models', zh: '你的服务商已列入 /v1/models', fr: 'votre fournisseur est dans /v1/models' },
  'addon.snippetNote': { vi: 'đang bật tự động trong Model Finder', en: 'auto-enabled in Model Finder', zh: '在模型查找中自动启用', fr: 'activé automatiquement dans Model Finder' },
  'addon.uninstall': { vi: 'Gỡ cài đặt', en: 'Uninstall', zh: '卸载', fr: 'Désinstaller' },
  'addon.howToTitle': { vi: 'Cách viết một file .addon', en: 'How to write a .addon file', zh: '如何编写 .addon 文件', fr: 'Comment écrire un fichier .addon' },
  'addon.howToTheme': { vi: 'Engine tự sinh 11 shade cho accent + surface, và vẫn hợp lệ thủ công biến "--color-cyan-500": "6 182 212".', en: 'The engine auto-generates 11 shades for accent + surface, and manual vars like "--color-cyan-500": "6 182 212" still work.', zh: '引擎自动为 accent + surface 生成 11 个色阶，手动变量 "--color-cyan-500": "6 182 212" 依然有效。', fr: 'Le moteur génère 11 nuances pour accent + surface ; les variables manuelles comme "--color-cyan-500": "6 182 212" restent valides.' },
  'addon.howToProvider': { vi: 'Cài xong xuất hiện ngay trong Model Finder và gọi được qua /v1.', en: 'Once installed it appears in Model Finder and is callable via /v1.', zh: '安装后立即出现在模型查找中，可通过 /v1 调用。', fr: 'Une fois installé, il apparaît dans Model Finder et est appelable via /v1.' },
  'addon.howToSnippet': { vi: 'Chỉ bật/tắt hành vi đã được WENKER định nghĩa sẵn — không chạy JS tùy tiện (an toàn).', en: 'Only toggles behaviours WENKER already defines — arbitrary JS is never executed (safe).', zh: '仅开关 WENKER 预定义的行为——不执行任意 JS（安全）。', fr: 'Bascule uniquement des comportements définis par WENKER — aucun JS arbitraire exécuté (sûr).' },
  'addon.noteStore': { vi: 'Ghi chú: add-on lưu tại', en: 'Note: add-ons are stored at', zh: '注意：插件存储于', fr: 'Remarque : les extensions sont stockées dans' },
  'addon.noteHome': { vi: 'để đổi chỗ lưu trữ.', en: 'to change the storage location.', zh: '以更改存储位置。', fr: 'pour changer l\u2019emplacement de stockage.' },

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
  'pg.model': { vi: 'Model Miễn Phí:', en: 'Free model:', zh: '免费模型：', fr: 'Modèle gratuit :' },
  'pg.freeTier': { vi: 'Free tier • Có giới hạn hạn mức', en: 'Free tier · quota-limited', zh: '免费额度 · 有限制', fr: 'Palier gratuit · quota limité' },
  'pg.latency': { vi: 'Độ trễ', en: 'Latency', zh: '延迟', fr: 'Latence' },
  'pg.params': { vi: 'Tham Số', en: 'Params', zh: '参数', fr: 'Paramètres' },
  'pg.clear': { vi: 'Xóa Chat', en: 'Clear chat', zh: '清空对话', fr: 'Effacer' },
  'pg.clearTitle': { vi: 'Làm mới cuộc trò chuyện', en: 'Reset the conversation', zh: '重置对话', fr: 'Réinitialiser la conversation' },
  'pg.copyContent': { vi: 'Sao chép nội dung', en: 'Copy content', zh: '复制内容', fr: 'Copier le contenu' },
  'pg.generating': { vi: 'WENKER Cloud đang sinh phản hồi...', en: 'WENKER Cloud is generating a reply...', zh: 'WENKER Cloud 正在生成回复...', fr: 'WENKER Cloud génère une réponse...' },
  'pg.quotaToday': { vi: 'WENKER Cloud hôm nay: còn', en: 'WENKER Cloud today:', zh: '今日 WENKER Cloud：剩余', fr: "WENKER Cloud aujourd'hui :" },
  'pg.quotaTurns': { vi: 'lượt', en: 'turns', zh: '次', fr: 'turns' },
  'pg.quotaAds': { vi: '(đã +{n} từ quảng cáo)', en: '(+{n} from ads)', zh: '（来自广告 +{n}）', fr: '(+{n} via publicité)' },
  'pg.inputPh': { vi: 'Nhập câu hỏi cho {model}... (Enter để gửi)', en: 'Ask {model}... (Enter to send)', zh: '向 {model} 提问…（回车发送）', fr: 'Interrogez {model}... (Entrée pour envoyer)' },
  'pg.send': { vi: 'Gửi', en: 'Send', zh: '发送', fr: 'Envoyer' },

  // ---------- Common ----------
  'common.save': { vi: 'Lưu', en: 'Save', zh: '保存', fr: 'Enregistrer' },
  'common.saved': { vi: 'Đã Lưu Thành Công', en: 'Saved', zh: '已保存', fr: 'Enregistré' },
  'common.saveChanges': { vi: 'Lưu Thay Đổi', en: 'Save changes', zh: '保存更改', fr: 'Enregistrer les modifications' },
  'common.cancel': { vi: 'Hủy', en: 'Cancel', zh: '取消', fr: 'Annuler' },
  'common.delete': { vi: 'Xóa', en: 'Delete', zh: '删除', fr: 'Supprimer' },
  'common.copy': { vi: 'Sao chép', en: 'Copy', zh: '复制', fr: 'Copier' },
  'common.copied': { vi: 'Đã chép', en: 'Copied', zh: '已复制', fr: 'Copié' },
  'common.close': { vi: 'Đóng', en: 'Close', zh: '关闭', fr: 'Fermer' },
  'common.yes': { vi: 'Có', en: 'Yes', zh: '是', fr: 'Oui' },
  'common.no': { vi: 'Không', en: 'No', zh: '否', fr: 'Non' },
  'common.error': { vi: 'Lỗi', en: 'Error', zh: '错误', fr: 'Erreur' },
  'common.retry': { vi: 'Thử lại', en: 'Retry', zh: '重试', fr: 'Réessayer' },
  'common.edit': { vi: 'Chỉnh sửa', en: 'Edit', zh: '编辑', fr: 'Modifier' },
  'common.optional': { vi: 'Tùy chọn', en: 'Optional', zh: '可选', fr: 'Facultatif' },
  'common.open': { vi: 'Mở', en: 'Open', zh: '打开', fr: 'Ouvrir' },
  'common.none': { vi: '—', en: '—', zh: '—', fr: '—' },
  'common.notSet': { vi: 'Chưa cấu hình', en: 'Not set', zh: '未配置', fr: 'Non configuré' },

  // ---------- Sidebar / nav sections ----------
  'nav.sectionMain': { vi: 'Điều hướng', en: 'Navigation', zh: '导航', fr: 'Navigation' },
  'nav.sectionSystem': { vi: 'Hệ thống', en: 'System', zh: '系统', fr: 'Système' },
  'nav.collapse': { vi: 'Thu gọn thanh bên', en: 'Collapse sidebar', zh: '收起侧边栏', fr: 'Réduire la barre latérale' },
  'nav.expand': { vi: 'Mở rộng thanh bên', en: 'Expand sidebar', zh: '展开侧边栏', fr: 'Développer la barre latérale' },
  'nav.menu': { vi: 'Menu', en: 'Menu', zh: '菜单', fr: 'Menu' },

  // ---------- Login ----------
  'login.tagline': { vi: 'Cổng proxy AI cục bộ', en: 'Local AI proxy gateway', zh: '本地 AI 代理网关', fr: 'Passerelle proxy IA locale' },
  'login.verifyTitle': { vi: 'Xác minh bạn không phải bot', en: 'Verify you are not a bot', zh: '验证你不是机器人', fr: 'Vérifiez que vous n\u2019êtes pas un robot' },
  'login.verifySubA': { vi: 'Không cần tên tài khoản. Nhập', en: 'No username needed. Enter the', zh: '无需用户名。输入', fr: 'Aucun nom d\u2019utilisateur requis. Saisissez le' },
  'login.verifySubB': { vi: 'mật khẩu gồm 1 chữ số', en: 'single-digit passcode', zh: '1 位数字密码', fr: 'code à un seul chiffre' },
  'login.verifySubC': { vi: 'được in sẵn bên dưới (mỗi số là một người dùng).', en: 'printed below (each digit is a user).', zh: '（每个数字即一个用户）。', fr: 'affiché ci-dessous (chaque chiffre est un utilisateur).' },
  'login.passwordLabel': { vi: 'Mật khẩu', en: 'Passcode', zh: '密码', fr: 'Code' },
  'login.errDigit': { vi: 'Mật khẩu là một chữ số từ 1 đến 9.', en: 'The passcode is a single digit from 1 to 9.', zh: '密码为 1 到 9 的单个数字。', fr: 'Le code est un chiffre de 1 à 9.' },
  'login.verifying': { vi: 'Đang xác minh...', en: 'Verifying...', zh: '正在验证…', fr: 'Vérification...' },
  'login.selected': { vi: 'Đã chọn:', en: 'Selected:', zh: '已选择：', fr: 'Sélection :' },
  'login.hint': { vi: 'Bấm một chữ số (1-9) để vào', en: 'Tap a digit (1-9) to enter', zh: '点击数字（1-9）进入', fr: 'Touchez un chiffre (1-9) pour entrer' },
  'login.reenter': { vi: 'Nhập lại', en: 'Re-enter', zh: '重新输入', fr: 'Ressaisir' },
  'login.footNote': { vi: 'Mỗi số 1-9 là một người dùng riêng với hạn mức WENKER Cloud theo ngày.', en: 'Each digit 1-9 is a separate user with a daily WENKER Cloud quota.', zh: '每个数字 1-9 都是独立用户，具有每日 WENKER Cloud 限额。', fr: 'Chaque chiffre 1-9 est un utilisateur distinct avec un quota WENKER Cloud quotidien.' },

  // ---------- Dashboard integrations ----------
  'dash.readyBadge': { vi: 'Sẵn Sàng Hoạt Động', en: 'Ready', zh: '就绪', fr: 'Prêt' },
  'dash.integClaudeDesc': { vi: 'Công cụ lập trình terminal của Anthropic', en: 'Anthropic\u2019s terminal coding tool', zh: 'Anthropic 的终端编程工具', fr: 'L\u2019outil de code en terminal d\u2019Anthropic' },
  'dash.integCursorDesc': { vi: 'Cấu hình trong Cursor Settings > Models > OpenAI API Key', en: 'Set in Cursor Settings > Models > OpenAI API Key', zh: '在 Cursor 设置 > 模型 > OpenAI API 密钥中配置', fr: 'Réglable dans Cursor Settings > Models > OpenAI API Key' },
  'dash.integClineDesc': { vi: 'Chọn Provider là "OpenAI Compatible"', en: 'Choose provider "OpenAI Compatible"', zh: '选择服务商“OpenAI Compatible”', fr: 'Choisissez le fournisseur « OpenAI Compatible »' },
  'dash.integCurlDesc': { vi: 'Kiểm tra nhanh qua dòng lệnh cURL', en: 'Quick test via the cURL command line', zh: '通过 cURL 命令行快速测试', fr: 'Test rapide via la ligne de commande cURL' },

  // ---------- Playground ----------
  'pg.welcome': { vi: 'Xin chào! Đây là **WENKER Free Playground** - các yêu cầu được gửi trực tiếp tới nhà cung cấp miễn phí (tier ẩn danh của bên thứ ba).\n\nLưu ý: hàng đợi ẩn danh có giới hạn, nếu upstream hết hạn mức bạn sẽ nhận được **thông báo lỗi thật** (502/402) thay vì nội dung mô phỏng. Nguồn cần key thì vẫn phải cấu hình key của bạn. Chọn mô hình phía trên và bắt đầu trò chuyện!', en: 'Hi! This is the **WENKER Free Playground** - requests go straight to free providers (third-party anonymous tiers).\n\nNote: the anonymous queue is limited; if upstream runs out you get a **real error** (502/402) instead of simulated content. Sources that need a key still require yours. Pick a model above and start chatting!', zh: '你好！这里是 **WENKER 免费试玩**——请求直接发往免费服务商（第三方匿名额度）。\n\n注意：匿名队列有限，若上游额度用尽，你会收到**真实错误**（502/402）而非模拟内容。需要密钥的来源仍需你的密钥。在上方选择模型开始对话！', fr: 'Bonjour ! Ceci est le **Playground gratuit WENKER** - les requêtes partent directement vers les fournisseurs gratuits (paliers anonymes tiers).\n\nNote : la file anonyme est limitée ; si le quota upstream est épuisé, vous recevez une **vraie erreur** (502/402) au lieu d\u2019un contenu simulé. Une source exigeant une clé nécessite toujours la vôtre. Choisissez un modèle ci-dessus et discutez !' },
  'pg.modelSwitched': { vi: 'Đã chuyển sang model `{model}` (gửi từ **Model Finder**). Gõ tin nhắn để bắt đầu — WENKER sẽ tự định tuyến tới nhà cung cấp phù hợp.', en: 'Switched to model `{model}` (sent from **Model Finder**). Type a message to begin — WENKER routes to the right provider automatically.', zh: '已切换到模型 `{model}`（来自**模型查找**）。输入消息即可开始——WENKER 会自动路由到合适的服务商。', fr: 'Passé au modèle `{model}` (envoyé depuis **Model Finder**). Tapez un message pour commencer — WENKER route vers le bon fournisseur automatiquement.' },
  'pg.sysDefault': { vi: 'Bạn là trợ lý AI thông minh từ WENKER Router, trả lời ngắn gọn, chính xác và định dạng code đẹp.', en: 'You are a smart AI assistant from WENKER Router; answer concisely, accurately, and format code nicely.', zh: '你是来自 WENKER Router 的智能 AI 助手，回答简洁、准确，并良好地格式化代码。', fr: 'Vous êtes un assistant IA de WENKER Router ; répondez de façon concise, précise et bien formatée.' },
  'pg.sysLabel': { vi: 'System Prompt (Chỉ dẫn hệ thống):', en: 'System prompt:', zh: '系统提示词：', fr: 'Prompt système :' },
  'pg.sysPh': { vi: 'Nhập vai AI...', en: 'Set the AI role...', zh: '输入 AI 角色…', fr: 'Définissez le rôle de l\u2019IA...' },
  'pg.tempLabel': { vi: 'Temperature (Sự sáng tạo):', en: 'Temperature (creativity):', zh: '温度（创造性）：', fr: 'Température (créativité) :' },
  'pg.tempHint': { vi: '0.0 = Chính xác, 1.0 = Sáng tạo', en: '0.0 = precise, 1.0 = creative', zh: '0.0 = 精确，1.0 = 创造性', fr: '0.0 = précis, 1.0 = créatif' },
  'pg.quotaExhausted': { vi: 'Bạn đã dùng hết lượt WENKER Cloud hôm nay. Đổi model khác hoặc xem quảng cáo để nhận thêm lượt.', en: 'You have used up your WENKER Cloud allowance today. Switch model or watch an ad for more turns.', zh: '你今天已用完 WENKER Cloud 额度。更换模型或观看广告以获得更多次数。', fr: 'Vous avez épuisé votre quota WENKER Cloud aujourd\u2019hui. Changez de modèle ou regardez une pub pour obtenir des tours.' },
  'pg.watchAd': { vi: 'Xem quảng cáo (+{n})', en: 'Watch an ad (+{n})', zh: '观看广告（+{n}）', fr: 'Voir une pub (+{n})' },
  'pg.opening': { vi: 'Đang mở...', en: 'Opening...', zh: '正在打开…', fr: 'Ouverture...' },
  'pg.availableModels': { vi: 'Model khả dụng:', en: 'Available models:', zh: '可用模型：', fr: 'Modèles disponibles :' },
  'pg.aliveSources': { vi: 'Nguồn đang sống:', en: 'Live sources:', zh: '存活来源：', fr: 'Sources actives :' },
  'pg.connError': { vi: '**Lỗi kết nối**: {msg}\n\n*Gợi ý*: Kiểm tra tab "Nhà Cung Cấp" hoặc thử chọn mô hình khác trong danh sách miễn phí!', en: '**Connection error**: {msg}\n\n*Tip*: Check the "Providers" tab or try another model from the free list!', zh: '**连接错误**：{msg}\n\n*提示*：检查“服务商”页，或在免费列表中选择其他模型！', fr: '**Erreur de connexion** : {msg}\n\n*Astuce* : vérifiez l\u2019onglet Fournisseurs ou essayez un autre modèle gratuit !' },
  'pg.cleared': { vi: 'Cuộc trò chuyện đã được làm mới. Hãy chọn mô hình và bắt đầu gửi tin nhắn!', en: 'Conversation reset. Pick a model and start sending messages!', zh: '对话已重置。选择模型并开始发送消息！', fr: 'Conversation réinitialisée. Choisissez un modèle et envoyez des messages !' },
  'pg.adGranted': { vi: 'Đã nhận thêm +{n} lượt chat.', en: 'Received +{n} more chat turns.', zh: '已获得 +{n} 次对话。', fr: '+{n} tours de chat reçus.' },
  'pg.adNone': { vi: 'Hôm nay đã hết lượt xem quảng cáo.', en: 'No ad views left today.', zh: '今天已无广告观看次数。', fr: 'Plus de vues publicitaires aujourd\u2019hui.' },
  'pg.adFail': { vi: 'Không thể mở trang quảng cáo.', en: 'Could not open the ad page.', zh: '无法打开广告页面。', fr: 'Impossible d\u2019ouvrir la page publicitaire.' },
  'pg.s1': { vi: 'Giải thích thuật toán Dijkstra bằng code JavaScript có chú thích chi tiết', en: 'Explain Dijkstra\u2019s algorithm in well-commented JavaScript', zh: '用带详细注释的 JavaScript 解释 Dijkstra 算法', fr: 'Expliquez l\u2019algorithme de Dijkstra en JavaScript commenté' },
  'pg.s2': { vi: 'Viết một REST API bằng Express.js quản lý giỏ hàng với JWT', en: 'Write an Express.js REST API for a cart with JWT', zh: '用 Express.js 编写带 JWT 的购物车 REST API', fr: 'Écrivez une API REST Express.js pour un panier avec JWT' },
  'pg.s3': { vi: 'So sánh sự khác nhau giữa React Server Components và Client Components', en: 'Compare React Server Components and Client Components', zh: '比较 React 服务器组件与客户端组件的区别', fr: 'Comparez les Server et Client Components de React' },
  'pg.s4': { vi: 'Viết prompt tối ưu cho Claude Code CLI để refactor codebase lớn', en: 'Write an optimal Claude Code CLI prompt to refactor a large codebase', zh: '为 Claude Code CLI 编写优化提示词以重构大型代码库', fr: 'Rédigez un prompt Claude Code CLI pour refactorer un gros codebase' },

  // ---------- Providers ----------
  'cat.all': { vi: 'Tất Cả', en: 'All', zh: '全部', fr: 'Tous' },
  'cat.wenker': { vi: 'WENKER Cloud', en: 'WENKER Cloud', zh: 'WENKER Cloud', fr: 'WENKER Cloud' },
  'cat.free': { vi: 'Miễn Phí (No-Auth)', en: 'Free (no-auth)', zh: '免费（免鉴权）', fr: 'Gratuits (sans auth)' },
  'cat.flagship': { vi: 'Big Tech', en: 'Big Tech', zh: '大厂旗舰', fr: 'Géants tech' },
  'cat.inference': { vi: 'Cloud Inference', en: 'Cloud inference', zh: '云端推理', fr: 'Inférence cloud' },
  'cat.china': { vi: 'Trung Quốc (Asia)', en: 'China (Asia)', zh: '中国（亚洲）', fr: 'Chine (Asie)' },
  'cat.local': { vi: 'Local Runtimes', en: 'Local runtimes', zh: '本地运行时', fr: 'Exécutions locales' },
  'cat.coding': { vi: 'Coding & Agents', en: 'Coding & agents', zh: '编程与智能体', fr: 'Code & agents' },
  'cat.specialized': { vi: 'Chuyên Sâu', en: 'Specialized', zh: '专业领域', fr: 'Spécialisés' },
  'cat.custom': { vi: 'Tùy Chỉnh', en: 'Custom', zh: '自定义', fr: 'Personnalisés' },
  'prov.probeAll': { vi: 'Test nguồn sống', en: 'Test live sources', zh: '测试存活来源', fr: 'Tester les sources' },
  'prov.probeAllTitle': { vi: 'Gửi 1 câu chat thật tới từng nguồn miễn phí để biết nguồn nào còn sống', en: 'Send one real chat request to each free source to see which are alive', zh: '向每个免费来源发送一次真实对话，判断哪些仍存活', fr: 'Envoie une vraie requête à chaque source gratuite pour voir lesquelles répondent' },
  'prov.probing': { vi: 'Đang kiểm tra...', en: 'Checking...', zh: '检查中…', fr: 'Vérification...' },
  'prov.addProvider': { vi: 'Thêm Nhà Cung Cấp', en: 'Add provider', zh: '添加服务商', fr: 'Ajouter un fournisseur' },
  'prov.searchPh': { vi: 'Tìm kiếm theo tên nhà cung cấp hoặc model (gpt-4o, claude, deepseek)...', en: 'Search by provider or model name (gpt-4o, claude, deepseek)...', zh: '按服务商或模型名搜索（gpt-4o、claude、deepseek）…', fr: 'Rechercher par fournisseur ou modèle (gpt-4o, claude, deepseek)...' },
  'h.notTested': { vi: 'Chưa test', en: 'Not tested', zh: '未测试', fr: 'Non testé' },
  'h.stale': { vi: 'Cũ {n}p', en: 'Old {n}m', zh: '{n} 分钟前', fr: 'Ancien {n}m' },
  'h.alive': { vi: 'Sống {n}ms', en: 'Live {n}ms', zh: '存活 {n}ms', fr: 'Vif {n}ms' },
  'h.needKey': { vi: 'Cần key', en: 'Needs key', zh: '需要密钥', fr: 'Clé requise' },
  'h.freeOut': { vi: 'Hết lượt free', en: 'Free quota out', zh: '免费额度用尽', fr: 'Quota gratuit épuisé' },
  'h.dead': { vi: 'Chết', en: 'Down', zh: '已下线', fr: 'Hors ligne' },
  'prov.free': { vi: 'Miễn phí', en: 'Free', zh: '免费', fr: 'Gratuit' },
  'prov.paid': { vi: 'Trả phí', en: 'Paid', zh: '付费', fr: 'Payant' },
  'prov.needKeyBadge': { vi: 'Cần API key', en: 'Needs API key', zh: '需要 API 密钥', fr: 'Clé API requise' },
  'prov.noKeyBadge': { vi: 'Không cần key', en: 'No key needed', zh: '无需密钥', fr: 'Aucune clé requise' },
  'prov.toggleOn': { vi: 'Đang Bật - Bấm để Tắt', en: 'On - click to turn off', zh: '已启用 - 点击关闭', fr: 'Activé - cliquer pour désactiver' },
  'prov.toggleOff': { vi: 'Đang Tắt - Bấm để Bật', en: 'Off - click to turn on', zh: '已禁用 - 点击启用', fr: 'Désactivé - cliquer pour activer' },
  'prov.modelsLabel': { vi: 'Mô hình', en: 'Models', zh: '模型', fr: 'Modèles' },
  'prov.more': { vi: '+{n} nữa', en: '+{n} more', zh: '还有 {n} 个', fr: '+{n} de plus' },
  'prov.pingTitle': { vi: 'Kiểm tra độ trễ mạng', en: 'Check network latency', zh: '检查网络延迟', fr: 'Vérifier la latence réseau' },
  'prov.testTitle': { vi: 'Gửi 1 câu chat thật tới provider này (kiểm tra model có trả lời được không)', en: 'Send one real chat request to this provider (checks if the model answers)', zh: '向该服务商发送一次真实对话（检查模型是否应答）', fr: 'Envoie une vraie requête à ce fournisseur (vérifie la réponse du modèle)' },
  'prov.copyBaseTitle': { vi: 'Sao chép Base URL', en: 'Copy Base URL', zh: '复制 Base URL', fr: 'Copier l\u2019URL de base' },
  'prov.deleteCustomTitle': { vi: 'Xóa custom provider', en: 'Delete custom provider', zh: '删除自定义服务商', fr: 'Supprimer le fournisseur personnalisé' },
  'prov.configured': { vi: 'Đã Cấu Hình', en: 'Configured', zh: '已配置', fr: 'Configuré' },
  'prov.configure': { vi: 'Cấu Hình', en: 'Configure', zh: '配置', fr: 'Configurer' },
  'prov.deleteConfirm': { vi: 'Bạn có chắc muốn xóa nhà cung cấp tùy chỉnh này?', en: 'Delete this custom provider?', zh: '确定删除该自定义服务商吗？', fr: 'Supprimer ce fournisseur personnalisé ?' },
  'prov.configSub': { vi: 'Nhập API Key, Cookie hoặc tinh chỉnh Base URL theo nhu cầu riêng.', en: 'Enter an API key, cookie, or tweak the Base URL as needed.', zh: '按需输入 API 密钥、Cookie 或调整 Base URL。', fr: 'Saisissez une clé API, un cookie ou ajustez l\u2019URL de base.' },
  'prov.apiKeyLabel': { vi: 'API Key', en: 'API key', zh: 'API 密钥', fr: 'Clé API' },
  'prov.notRequired': { vi: 'KHÔNG BẮT BUỘC', en: 'OPTIONAL', zh: '非必填', fr: 'FACULTATIF' },
  'prov.noKeyPlaceholder': { vi: 'Bỏ trống - nguồn này không cần key', en: 'Leave blank - this source needs no key', zh: '留空——此来源无需密钥', fr: 'Laisser vide - cette source ne demande pas de clé' },
  'prov.noKeyHelp': { vi: 'Nguồn này không yêu cầu xác thực — để trống vẫn dùng được. Chỉ nhập key nếu muốn nâng tier (ví dụ Pollinations ẩn danh hết budget → thêm key miễn phí để hồi sinh).', en: 'This source needs no auth — leave it blank and it still works. Only add a key to upgrade the tier (e.g. anonymous Pollinations runs out of budget → add a free key to revive it).', zh: '此来源无需鉴权——留空仍可用。仅当你想升级额度时才输入密钥（例如匿名 Pollinations 用尽预算 → 添加免费密钥以恢复）。', fr: 'Cette source ne demande aucune auth — laissez vide, elle fonctionne. Ajoutez une clé seulement pour monter de palier (ex. Pollinations anonyme à court de budget → ajoutez une clé gratuite).' },
  'prov.keyHelpAuth': { vi: 'Cách lấy key miễn phí:', en: 'How to get a free key:', zh: '如何获取免费密钥：', fr: 'Comment obtenir une clé gratuite :' },
  'prov.keyHelpOpt': { vi: 'Tùy chọn - cách lấy key miễn phí:', en: 'Optional - how to get a free key:', zh: '可选 - 如何获取免费密钥：', fr: 'Facultatif - obtenir une clé gratuite :' },
  'prov.openPage': { vi: 'Mở trang', en: 'Open page', zh: '打开页面', fr: 'Ouvrir la page' },
  'prov.cookieLabel': { vi: 'Cookie / Session Token (Tùy chọn):', en: 'Cookie / session token (optional):', zh: 'Cookie / 会话令牌（可选）：', fr: 'Cookie / jeton de session (facultatif) :' },
  'prov.cookiePh': { vi: 'session_token=... (dành cho các provider hỗ trợ cookie auth)', en: 'session_token=... (for providers supporting cookie auth)', zh: 'session_token=...（用于支持 Cookie 鉴权的服务商）', fr: 'session_token=... (fournisseurs acceptant l\u2019auth par cookie)' },
  // detail modal
  'prov.info': { vi: 'Thông tin', en: 'Information', zh: '信息', fr: 'Informations' },
  'prov.config': { vi: 'Cấu hình', en: 'Configuration', zh: '配置', fr: 'Configuration' },
  'prov.category': { vi: 'Danh mục', en: 'Category', zh: '分类', fr: 'Catégorie' },
  'prov.modelCount': { vi: 'Số mô hình', en: 'Model count', zh: '模型数量', fr: 'Nombre de modèles' },
  'prov.authType': { vi: 'Loại xác thực', en: 'Auth type', zh: '鉴权类型', fr: 'Type d\u2019auth' },
  'prov.headerName': { vi: 'Tên header', en: 'Header name', zh: 'Header 名称', fr: 'Nom de l\u2019en-tête' },
  'prov.requiresKey': { vi: 'Yêu cầu API Key', en: 'Requires API key', zh: '需要 API 密钥', fr: 'Nécessite une clé API' },
  'prov.savedKey': { vi: 'API Key đã lưu', en: 'Saved API key', zh: '已保存的密钥', fr: 'Clé API enregistrée' },
  'prov.savedCookie': { vi: 'Cookie / Token đã lưu', en: 'Saved cookie / token', zh: '已保存的 Cookie / 令牌', fr: 'Cookie / jeton enregistré' },
  'prov.checkStatus': { vi: 'Trạng thái kiểm tra', en: 'Check status', zh: '检查状态', fr: 'État du test' },
  'prov.notChecked': { vi: 'Chưa kiểm tra', en: 'Not checked', zh: '未检查', fr: 'Non vérifié' },
  'prov.oldResult': { vi: 'Kết quả cũ ({n} phút trước)', en: 'Stale result ({n} min ago)', zh: '旧结果（{n} 分钟前）', fr: 'Résultat ancien ({n} min)' },
  'prov.aliveStatus': { vi: 'Đang sống ({n}ms)', en: 'Live ({n}ms)', zh: '存活（{n}ms）', fr: 'Actif ({n}ms)' },
  'prov.needKeyStatus': { vi: 'Cần API Key', en: 'Needs API key', zh: '需要 API 密钥', fr: 'Clé API requise' },
  'prov.freeOutStatus': { vi: 'Nguồn sống nhưng hết lượt miễn phí — thêm key miễn phí để tiếp tục', en: 'Source is live but free quota is out — add a free key to continue', zh: '来源存活但免费额度用尽——添加免费密钥以继续', fr: 'Source active mais quota gratuit épuisé — ajoutez une clé gratuite' },
  'prov.noAnswerStatus': { vi: 'Không trả lời', en: 'No answer', zh: '无应答', fr: 'Aucune réponse' },
  'prov.howToGetKey': { vi: 'Cách lấy API Key miễn phí', en: 'How to get a free API key', zh: '如何获取免费 API 密钥', fr: 'Obtenir une clé API gratuite' },
  'prov.openSignup': { vi: 'Mở trang đăng ký', en: 'Open signup page', zh: '打开注册页面', fr: 'Ouvrir la page d\u2019inscription' },
  'prov.editConfig': { vi: 'Chỉnh sửa cấu hình', en: 'Edit configuration', zh: '编辑配置', fr: 'Modifier la configuration' },
  'prov.modelList': { vi: 'Mô hình', en: 'Models', zh: '模型', fr: 'Modèles' },
  'prov.filterModelPh': { vi: 'Lọc model...', en: 'Filter models...', zh: '筛选模型…', fr: 'Filtrer les modèles...' },
  'prov.noMatch': { vi: 'Không có model nào khớp bộ lọc.', en: 'No models match the filter.', zh: '没有匹配的模型。', fr: 'Aucun modèle ne correspond au filtre.' },
  'prov.realModel': { vi: 'Model thực sự trả lời:', en: 'Model that actually answered:', zh: '实际应答的模型：', fr: 'Modèle ayant réellement répondu :' },
  'prov.copyModelTitle': { vi: 'Sao chép tên model', en: 'Copy model name', zh: '复制模型名', fr: 'Copier le nom du modèle' },
  'prov.enabled': { vi: 'Đang bật', en: 'Enabled', zh: '已启用', fr: 'Activé' },
  'prov.disabled': { vi: 'Đang tắt', en: 'Disabled', zh: '已禁用', fr: 'Désactivé' },
  'prov.healthTipTitle': { vi: 'Bấm "Test" để kiểm tra nguồn này có thực sự trả lời không', en: 'Click "Test" to check whether this source really answers', zh: '点击“Test”以检查该来源是否真的应答', fr: 'Cliquez sur « Test » pour vérifier que cette source répond' },
  'prov.sampleAnswer': { vi: 'Model đầu bảng trả lời: "{s}"', en: 'Top model answered: "{s}"', zh: '首位模型应答：“{s}”', fr: 'Le modèle principal a répondu : « {s} »' },
  // add custom modal
  'prov.addTitle': { vi: 'Thêm Nhà Cung Cấp Mới (Custom Provider)', en: 'Add a New Provider (Custom)', zh: '添加新服务商（自定义）', fr: 'Ajouter un fournisseur (personnalisé)' },
  'prov.addSub': { vi: 'Thêm bất kỳ máy chủ LLM nội bộ (vLLM, Ollama, LM Studio) hoặc Cloud AI Gateway tùy ý.', en: 'Add any local LLM server (vLLM, Ollama, LM Studio) or a custom cloud AI gateway.', zh: '添加任意本地 LLM 服务器（vLLM、Ollama、LM Studio）或自定义云 AI 网关。', fr: 'Ajoutez n\u2019importe quel serveur LLM local (vLLM, Ollama, LM Studio) ou une passerelle cloud.' },
  'prov.nameLabel': { vi: 'Tên Nhà Cung Cấp:', en: 'Provider name:', zh: '服务商名称：', fr: 'Nom du fournisseur :' },
  'prov.namePh': { vi: 'Ví dụ: Cụm GPU Local Cty, My Private Gateway', en: 'e.g. Company Local GPU Cluster, My Private Gateway', zh: '例如：公司本地 GPU 集群、我的私有网关', fr: 'ex. Cluster GPU local, Ma passerelle privée' },
  'prov.authLabel': { vi: 'Loại Xác Thực:', en: 'Auth type:', zh: '鉴权类型：', fr: 'Type d\u2019auth :' },
  'prov.authBearer': { vi: 'Bearer Token (Header: Authorization)', en: 'Bearer token (header: Authorization)', zh: 'Bearer 令牌（Header: Authorization）', fr: 'Jeton Bearer (en-tête : Authorization)' },
  'prov.authApiKey': { vi: 'API Key (Header: x-api-key)', en: 'API key (header: x-api-key)', zh: 'API 密钥（Header: x-api-key）', fr: 'Clé API (en-tête : x-api-key)' },
  'prov.authNone': { vi: 'Không Cần Xác Thực (None / Free)', en: 'No auth (none / free)', zh: '无需鉴权（None / Free）', fr: 'Aucune auth (none / gratuit)' },
  'prov.authCookie': { vi: 'Cookie Session', en: 'Cookie session', zh: 'Cookie 会话', fr: 'Session par cookie' },
  'prov.defaultModelLabel': { vi: 'Tên Mô Hình Mặc Định:', en: 'Default model name:', zh: '默认模型名称：', fr: 'Nom du modèle par défaut :' },
  'prov.apiKeyIfAny': { vi: 'API Key / Token (Nếu có):', en: 'API key / token (if any):', zh: 'API 密钥 / 令牌（如有）：', fr: 'Clé API / jeton (le cas échéant) :' },
  'prov.apiKeyPh': { vi: 'Nhập API key...', en: 'Enter API key...', zh: '输入 API 密钥…', fr: 'Saisissez la clé API...' },
  'prov.modelNamePh': { vi: 'my-model-name', en: 'my-model-name', zh: 'my-model-name', fr: 'mon-modele' },
  'prov.descLabel': { vi: 'Mô Tả Ngắn:', en: 'Short description:', zh: '简短描述：', fr: 'Description courte :' },
  'prov.descPh': { vi: 'Mô tả mục đích sử dụng...', en: 'Describe the purpose...', zh: '描述用途…', fr: 'Décrivez l\u2019usage...' },
  'prov.freeCheck': { vi: 'Đánh dấu là nhà cung cấp Miễn Phí (Free Tier)', en: 'Mark as a free provider (Free Tier)', zh: '标记为免费服务商（Free Tier）', fr: 'Marquer comme fournisseur gratuit (Free Tier)' },
  'prov.createProvider': { vi: 'Tạo Nhà Cung Cấp', en: 'Create provider', zh: '创建服务商', fr: 'Créer le fournisseur' },
  'prov.configTitle': { vi: 'Cấu Hình', en: 'Configure', zh: '配置', fr: 'Configurer' },
  'prov.baseUrlLabel': { vi: 'Base URL:', en: 'Base URL:', zh: 'Base URL：', fr: 'URL de base :' },

  // ---------- Routing ----------
  'route.aliasTitle': { vi: 'Ánh Xạ Tên Mô Hình (Model Aliases)', en: 'Model Aliases', zh: '模型别名映射', fr: 'Alias de modèles' },
  'route.aliasSub': { vi: 'Khi client yêu cầu mô hình A, WENKER Router sẽ tự động chuyển hướng tới mô hình B.', en: 'When a client requests model A, WENKER Router redirects it to model B.', zh: '当客户端请求模型 A 时，WENKER Router 自动转发到模型 B。', fr: 'Quand un client demande le modèle A, WENKER le redirige vers le modèle B.' },
  'route.delAliasTitle': { vi: 'Xóa ánh xạ', en: 'Delete alias', zh: '删除别名', fr: 'Supprimer l\u2019alias' },
  'route.addNew': { vi: '+ Thêm Ánh Xạ Mới', en: '+ Add a new alias', zh: '+ 添加新别名', fr: '+ Ajouter un alias' },
  'route.aliasFromPh': { vi: 'Tên Client gọi (vd: gpt-4o)', en: 'Requested name (e.g. gpt-4o)', zh: '客户端请求名（如 gpt-4o）', fr: 'Nom demandé (ex. gpt-4o)' },
  'route.aliasToPh': { vi: 'Mô hình đích (vd: wenker-cloud/...)', en: 'Target model (e.g. wenker-cloud/...)', zh: '目标模型（如 wenker-cloud/...）', fr: 'Modèle cible (ex. wenker-cloud/...)' },
  'route.addRule': { vi: 'Thêm Quy Tắc', en: 'Add rule', zh: '添加规则', fr: 'Ajouter la règle' },
  'route.failoverTitle': { vi: 'Chính Sách Dự Phòng (Failover Rules)', en: 'Failover Rules', zh: '回退策略（故障转移）', fr: 'Règles de repli' },
  'route.failoverSub': { vi: 'Cơ chế tự động chuyển tiếp lưu lượng khi nhà cung cấp chính hết quota hoặc bị lỗi 429 / 500.', en: 'Automatically reroutes traffic when the primary provider runs out of quota or returns 429 / 500.', zh: '当主服务商额度用尽或返回 429 / 500 时自动转发流量。', fr: 'Redirige le trafic quand le fournisseur principal est à court de quota ou renvoie 429 / 500.' },
  'route.onlyRealErr': { vi: 'Chỉ khi lỗi thật', en: 'Only on real errors', zh: '仅真实错误时', fr: 'Uniquement sur erreur réelle' },
  'route.internetTitle': { vi: 'Mất Internet', en: 'Internet down', zh: '断网', fr: 'Internet coupé' },
  'route.realErrBadge': { vi: 'Lỗi thật', en: 'Real error', zh: '真实错误', fr: 'Erreur réelle' },
  'route.internetDesc': { vi: 'Khi toàn bộ chuỗi dự phòng chết, router trả lỗi 502/503 kèm hint — KHÔNG bịa câu trả lời giả lập (hành vi bịa đã bị xóa khỏi code).', en: 'When the whole failover chain is dead, the router returns a 502/503 with a hint — it never fabricates simulated answers (the fake-answer behavior was removed from the code).', zh: '当整条回退链全部失效时，路由器返回 502/503 并附带提示——绝不编造模拟回答（编造行为已从代码中移除）。', fr: 'Quand toute la chaîne de repli est morte, le routeur renvoie un 502/503 avec un indice — il n\u2019invente jamais de réponses simulées (ce comportement a été supprimé du code).' },
  'route.tipLabel': { vi: 'Mẹo:', en: 'Tip:', zh: '提示：', fr: 'Astuce :' },
  'route.tipBody': { vi: 'Sử dụng tiền tố providerId/modelName khi gửi prompt từ client (ví dụ groq/llama-3.3-70b-versatile hoặc wenker-cloud/wenker-deepseek-r1-free) để định tuyến chính xác 100% tới nhà cung cấp bạn mong muốn!', en: 'Use the providerId/modelName prefix when sending prompts from the client (e.g. groq/llama-3.3-70b-versatile or wenker-cloud/wenker-deepseek-r1-free) to route 100% precisely to the provider you want!', zh: '从客户端发送提示词时使用 providerId/modelName 前缀（例如 groq/llama-3.3-70b-versatile 或 wenker-cloud/wenker-deepseek-r1-free），即可 100% 精确路由到你期望的服务商！', fr: 'Utilisez le préfixe providerId/modèle lors des requêtes depuis le client (ex. groq/llama-3.3-70b-versatile ou wenker-cloud/wenker-deepseek-r1-free) pour router à 100 % vers le fournisseur voulu !' },
  'route.openaiDesc': { vi: 'Nếu upstream trả 429 / 5xx: thử lần lượt theo fallbackOrder (Cài đặt). Mỗi lần dự phòng đều bị đánh dấu "dự phòng" trong Nhật Ký. Thiếu API Key = lỗi 401 thẳng, không đổi provider.', en: 'If upstream returns 429 / 5xx: try each entry in fallbackOrder (Settings). Every failover is marked "fallback" in the Logs. Missing API key = a straight 401, no provider switch.', zh: '若上游返回 429 / 5xx：按 fallbackOrder（设置）依次尝试。每次回退都会在日志中标记“回退”。缺少 API 密钥 = 直接 401，不切换服务商。', fr: 'Si l\u2019amont renvoie 429 / 5xx : essayez chaque entrée de fallbackOrder (Paramètres). Chaque repli est marqué « fallback » dans les journaux. Clé API manquante = 401 direct, sans changement de fournisseur.' },
  'route.anthropicDesc': { vi: '/v1/messages dùng chung cơ chế trên. Chuỗi dự phòng chỉ chạy khi upstream lỗi thật, và câu trả lời luôn ghi rõ provider/model nào thực sự trả lời.', en: '/v1/messages shares the same mechanism. The failover chain only runs on real upstream errors, and every answer records which provider/model actually replied.', zh: '/v1/messages 使用相同机制。回退链仅在上游真实报错时运行，且每次回答都会记录实际应答的 provider/model。', fr: '/v1/messages partage ce mécanisme. La chaîne de repli ne s\u2019exécute qu\u2019en cas de vraie erreur amont, et chaque réponse note le provider/modèle réel.' },

  // ---------- Keys manager ----------
  'keys.create': { vi: 'Tạo API Key Mới', en: 'Create API key', zh: '创建 API 密钥', fr: 'Créer une clé API' },
  'keys.secTitle': { vi: 'Bảo Mật Local 100%', en: '100% local security', zh: '100% 本地安全', fr: 'Sécurité 100 % locale' },
  'keys.secBody': { vi: 'Các khóa API của WENKER Router được mã hóa và lưu trữ trực tiếp trên máy của bạn (không gửi đi máy chủ trung gian). Bạn có thể tự do tạo bao nhiêu khóa tùy thích cho từng dự án khác nhau.', en: 'WENKER Router API keys are encrypted and stored directly on your machine (never sent to any middleman). Create as many keys as you like, per project.', zh: 'WENKER Router 的 API 密钥会在你本机加密存储（绝不发送到任何中间服务器）。你可以按项目随意创建任意数量的密钥。', fr: 'Les clés API WENKER sont chiffrées et stockées sur votre machine (jamais envoyées à un intermédiaire). Créez autant de clés que vous voulez, par projet.' },
  'keys.colName': { vi: 'Tên Khóa', en: 'Key name', zh: '密钥名称', fr: 'Nom de la clé' },
  'keys.colKey': { vi: 'API Key (WENKER)', en: 'API key (WENKER)', zh: 'API 密钥（WENKER）', fr: 'Clé API (WENKER)' },
  'keys.colRole': { vi: 'Vai Trò', en: 'Role', zh: '角色', fr: 'Rôle' },
  'keys.colUsage': { vi: 'Lượt Dùng', en: 'Uses', zh: '使用次数', fr: 'Utilisations' },
  'keys.colTokens': { vi: 'Tokens Đã Xử Lý', en: 'Tokens processed', zh: '已处理 Tokens', fr: 'Tokens traités' },
  'keys.colStatus': { vi: 'Trạng Thái', en: 'Status', zh: '状态', fr: 'Statut' },
  'keys.colActions': { vi: 'Thao Tác', en: 'Actions', zh: '操作', fr: 'Actions' },
  'keys.copyFullTitle': { vi: 'Sao chép toàn bộ khóa', en: 'Copy full key', zh: '复制完整密钥', fr: 'Copier la clé complète' },
  'keys.active': { vi: 'Hoạt động', en: 'Active', zh: '活跃', fr: 'Actif' },
  'keys.locked': { vi: 'Đã khóa', en: 'Locked', zh: '已锁定', fr: 'Verrouillée' },
  'keys.deleteTitle': { vi: 'Xóa khóa', en: 'Delete key', zh: '删除密钥', fr: 'Supprimer la clé' },
  'keys.deleteConfirm': { vi: 'Bạn có chắc muốn xóa API key này? Các ứng dụng đang dùng key này sẽ mất quyền truy cập.', en: 'Delete this API key? Apps using it will lose access.', zh: '确定删除该 API 密钥吗？使用它的应用将失去访问权限。', fr: 'Supprimer cette clé API ? Les apps qui l\u2019utilisent perdront l\u2019accès.' },
  'keys.createTitle': { vi: 'Tạo WENKER API Key Mới', en: 'Create a WENKER API key', zh: '创建新的 WENKER API 密钥', fr: 'Créer une clé API WENKER' },
  'keys.createSub': { vi: 'Khóa API mới sẽ bắt đầu bằng tiền tố sk-wenker-...', en: 'New API keys start with the sk-wenker- prefix.', zh: '新的 API 密钥以 sk-wenker- 前缀开头。', fr: 'Les nouvelles clés commencent par le préfixe sk-wenker-.' },
  'keys.nameLabel': { vi: 'Tên Nhận Diện Khóa:', en: 'Key label:', zh: '密钥标签：', fr: 'Libellé de la clé :' },
  'keys.namePh': { vi: 'Ví dụ: Claude Code Key, Cursor Dev Key', en: 'e.g. Claude Code Key, Cursor Dev Key', zh: '例如：Claude Code Key、Cursor Dev Key', fr: 'ex. Clé Claude Code, Clé Cursor Dev' },
  'keys.roleLabel': { vi: 'Vai Trò / Quyền Hạn:', en: 'Role / permissions:', zh: '角色 / 权限：', fr: 'Rôle / permissions :' },
  'keys.roleAdmin': { vi: 'Admin (Toàn quyền)', en: 'Admin (full access)', zh: '管理员（完全权限）', fr: 'Admin (accès total)' },
  'keys.roleUser': { vi: 'Standard User (Sử dụng model)', en: 'Standard user (uses models)', zh: '标准用户（使用模型）', fr: 'Utilisateur standard (utilise les modèles)' },
  'keys.rateLabel': { vi: 'Giới Hạn Tốc Độ (Requests/phút):', en: 'Rate limit (requests/min):', zh: '速率限制（请求/分钟）：', fr: 'Limite de débit (requêtes/min) :' },
  'keys.generate': { vi: 'Sinh Khóa Ngay', en: 'Generate key now', zh: '立即生成密钥', fr: 'Générer la clé' },
  'keys.roleRead': { vi: 'Chỉ đọc (Read Only)', en: 'Read only', zh: '只读', fr: 'Lecture seule' },

  // ---------- Logs ----------
  'logs.autoRefresh': { vi: 'Tự Động Làm Mới (3s)', en: 'Auto-refresh (3s)', zh: '自动刷新（3秒）', fr: 'Rafraîchir auto (3 s)' },
  'logs.refresh': { vi: 'Làm Mới', en: 'Refresh', zh: '刷新', fr: 'Rafraîchir' },
  'logs.empty': { vi: 'Chưa có yêu cầu nào được ghi nhận. Hãy gửi thử 1 tin nhắn trong tab "Playground Miễn Phí" hoặc kết nối Cursor/Claude Code!', en: 'No requests logged yet. Send a message in the Free Playground or connect Cursor/Claude Code!', zh: '尚无请求记录。请在“免费试玩”发送一条消息，或连接 Cursor/Claude Code！', fr: 'Aucune requête enregistrée. Envoyez un message dans le Playground gratuit ou connectez Cursor/Claude Code !' },
  'logs.colTime': { vi: 'Thời Gian', en: 'Time', zh: '时间', fr: 'Heure' },
  'logs.colEndpoint': { vi: 'Endpoint', en: 'Endpoint', zh: '端点', fr: 'Point de terminaison' },
  'logs.colReqModel': { vi: 'Model Yêu Cầu', en: 'Requested model', zh: '请求模型', fr: 'Modèle demandé' },
  'logs.colRealModel': { vi: 'Model Thực Trả Lời', en: 'Model that answered', zh: '实际应答模型', fr: 'Modèle ayant répondu' },
  'logs.colProvider': { vi: 'Provider Xử Lý', en: 'Handling provider', zh: '处理服务商', fr: 'Fournisseur' },
  'logs.colLatency': { vi: 'Độ Trễ', en: 'Latency', zh: '延迟', fr: 'Latence' },
  'logs.colTokens': { vi: 'Tokens', en: 'Tokens', zh: 'Tokens', fr: 'Tokens' },
  'logs.colStatus': { vi: 'Trạng Thái', en: 'Status', zh: '状态', fr: 'Statut' },
  'logs.aliasTip': { vi: 'Model bạn gọi là alias; đây là model upstream thực sự trả lời.', en: 'The model you called is an alias; this is the upstream model that actually answered.', zh: '你调用的模型是别名；这是实际应答的上游模型。', fr: 'Le modèle appelé est un alias ; voici le modèle amont qui a réellement répondu.' },
  'logs.fallbackTip': { vi: 'Dự phòng từ "{from}" ({reason})', en: 'Fallback from "{from}" ({reason})', zh: '从“{from}”回退（{reason}）', fr: 'Repli depuis « {from} » ({reason})' },
  'logs.fallbackLabel': { vi: 'dự phòng', en: 'fallback', zh: '回退', fr: 'repli' },
  'logs.upstreamErr': { vi: 'upstream lỗi', en: 'upstream error', zh: '上游错误', fr: 'erreur amont' },

  // ---------- Settings ----------
  'set.localTitle': { vi: 'Máy Chủ Cục Bộ (Local Server)', en: 'Local server', zh: '本地服务器', fr: 'Serveur local' },
  'set.portLabel': { vi: 'Cổng Lắng Nghe (Port):', en: 'Listening port:', zh: '监听端口：', fr: 'Port d\u2019écoute :' },
  'set.portHelp': { vi: 'Khởi động lại server để áp dụng thay đổi cổng.', en: 'Restart the server to apply the port change.', zh: '重启服务器以应用端口更改。', fr: 'Redémarrez le serveur pour appliquer le changement de port.' },
  'set.hostLabel': { vi: 'Host Lắng Nghe:', en: 'Listening host:', zh: '监听主机：', fr: 'Hôte d\u2019écoute :' },
  'set.hostHelp': { vi: '0.0.0.0 cho phép truy cập từ mạng LAN nội bộ.', en: '0.0.0.0 allows access from the local LAN.', zh: '0.0.0.0 允许从局域网访问。', fr: '0.0.0.0 autorise l\u2019accès depuis le LAN.' },
  'set.defaultModelLabel': { vi: 'Mô Hình Mặc Định Khi Không Khai Báo:', en: 'Default model when unspecified:', zh: '未指定时的默认模型：', fr: 'Modèle par défaut si non précisé :' },
  'set.failoverTitle': { vi: 'Cơ Chế Dự Phòng Thông Minh (Smart Failover)', en: 'Smart Failover', zh: '智能故障转移', fr: 'Repli intelligent' },
  'set.failoverCheck': { vi: 'Dự Phòng Khi Nguồn GỐC THỰC SỰ LỖI (429 / 5xx)', en: 'Fail over when the real source errors (429 / 5xx)', zh: '当真实来源报错时回退（429 / 5xx）', fr: 'Repli quand la source réelle échoue (429 / 5xx)' },
  'set.failoverHelp': { vi: 'Khi bật: nếu nhà cung cấp bạn gọi trả lỗi upstream thật (hết hạn mức 429, sập 5xx), router đi theo chuỗi dự phòng trong tab Định Tuyến và ghi rõ trong Nhật Ký provider nào thực sự trả lời (nhãn "dự phòng"). Từ bản này, router KHÔNG âm thầm chuyển provider khi thiếu API Key nữa — thiếu key là trả lỗi 401 thật, để bạn không bị ảo tưởng model đó đang chạy.', en: 'When on: if a provider returns a real upstream error (429 quota, 5xx down), the router follows the failover chain in the Routing tab and records which provider actually answered in the Logs ("fallback" label). From this version, the router no longer silently switches providers when an API key is missing — a missing key returns a real 401, so you are never fooled into thinking that model is running.', zh: '开启时：若你调用的服务商返回真实上游错误（429 额度用尽、5xx 宕机），路由器会按“路由”页中的回退链处理，并在日志中记录实际应答的 provider（“回退”标签）。从本版本起，缺少 API 密钥时路由器不再静默切换 provider——缺密钥会返回真实 401，避免你误以为该模型正在运行。', fr: 'Activé : si un fournisseur renvoie une vraie erreur amont (429 quota, 5xx), le routeur suit la chaîne de repli de l\u2019onglet Routage et note dans les journaux le fournisseur qui a réellement répondu (« fallback »). Depuis cette version, le routeur ne change plus silencieusement de fournisseur quand une clé manque — une clé absente renvoie un vrai 401.' },
  'set.proxyTitle': { vi: 'Kết nối ra ngoài qua VPN / Proxy cục bộ', en: 'Outbound via VPN / local proxy', zh: '通过 VPN / 本地代理出站', fr: 'Sortie via VPN / proxy local' },
  'set.proxyCheck': { vi: 'Đẩy mọi request upstream qua HTTP proxy', en: 'Route all upstream requests through an HTTP proxy', zh: '将所有上游请求经由 HTTP 代理', fr: 'Router toutes les requêtes amont via un proxy HTTP' },
  'set.proxyHelp': { vi: 'Dành cho VPN công cụ local (Clash, v2rayN, mihomo…) phát HTTP proxy trên máy bạn. Khi bật, router gửi mọi lời gọi tới OpenAI / Anthropic / Groq / OpenRouter… qua proxy này. Node không tự đọc biến HTTP_PROXY, nên phải khai báo ở đây.', en: 'For local VPN tools (Clash, v2rayN, mihomo...) exposing an HTTP proxy on your machine. When on, the router sends every OpenAI / Anthropic / Groq / OpenRouter call through this proxy. Node does not read HTTP_PROXY on its own, so declare it here.', zh: '适用于在你机器上暴露 HTTP 代理的本地 VPN 工具（Clash、v2rayN、mihomo…）。开启后，路由器会把所有 OpenAI / Anthropic / Groq / OpenRouter 调用经此代理发出。Node 不会自行读取 HTTP_PROXY，因此需在此声明。', fr: 'Pour les outils VPN locaux (Clash, v2rayN, mihomo...) exposant un proxy HTTP. Une fois activé, le routeur passe tous les appels OpenAI / Anthropic / Groq / OpenRouter par ce proxy. Node ne lit pas HTTP_PROXY seul, déclarez-le ici.' },
  'set.proxyUrlLabel': { vi: 'Địa chỉ Proxy (http://…):', en: 'Proxy address (http://…):', zh: '代理地址（http://…）：', fr: 'Adresse du proxy (http://…) :' },
  'set.proxyUrlHelp': { vi: 'Chỉ hỗ trợ proxy HTTP/HTTPS. SOCKS cần cấu hình riêng.', en: 'Only HTTP/HTTPS proxies supported. SOCKS needs separate setup.', zh: '仅支持 HTTP/HTTPS 代理。SOCKS 需另行配置。', fr: 'Proxies HTTP/HTTPS uniquement. SOCKS requiert une config séparée.' },
  'set.noProxyLabel': { vi: 'Bỏ qua proxy (NO_PROXY, phân tách bởi dấu phẩy):', en: 'Bypass proxy (NO_PROXY, comma-separated):', zh: '绕过代理（NO_PROXY，逗号分隔）：', fr: 'Exclusions proxy (NO_PROXY, séparées par des virgules) :' },
  'set.noProxyHelp': { vi: 'Vòng ngoài (localhost) và mạng riêng (10.x, 192.168.x, 172.16–31.x) LUÔN được bỏ qua tự động — model local (Ollama/LM Studio/vLLM) không bao giờ bị đẩy ra proxy.', en: 'Loopback (localhost) and private networks (10.x, 192.168.x, 172.16–31.x) are ALWAYS bypassed automatically — local models (Ollama/LM Studio/vLLM) are never sent through the proxy.', zh: '回环地址（localhost）和私有网络（10.x、192.168.x、172.16–31.x）始终自动绕过——本地模型（Ollama/LM Studio/vLLM）绝不会经代理。', fr: 'La boucle locale (localhost) et les réseaux privés (10.x, 192.168.x, 172.16–31.x) sont TOUJOURS exclus — les modèles locaux (Ollama/LM Studio/vLLM) ne passent jamais par le proxy.' },
  'set.testConn': { vi: 'Kiểm tra kết nối', en: 'Test connection', zh: '测试连接', fr: 'Tester la connexion' },
  'set.testOk': { vi: 'OK · IP ra ngoài', en: 'OK · outbound IP', zh: '成功 · 出口 IP', fr: 'OK · IP sortante' },
  'set.testFail': { vi: 'Thất bại:', en: 'Failed:', zh: '失败：', fr: 'Échec :' },
  'set.proxySaveNote': { vi: 'Nhấn Lưu Cấu Hình để áp dụng. Sau khi lưu, request mới dùng proxy ngay (không cần khởi động lại server).', en: 'Press Save to apply. After saving, new requests use the proxy immediately (no server restart needed).', zh: '点击“保存配置”以应用。保存后，新请求会立即使用代理（无需重启服务器）。', fr: 'Cliquez sur Enregistrer pour appliquer. Après sauvegarde, les nouvelles requêtes utilisent le proxy immédiatement (sans redémarrage).' },
  'set.quotaTitle': { vi: 'Hạn mức WENKER Cloud theo ngày', en: 'Daily WENKER Cloud quota', zh: '每日 WENKER Cloud 限额', fr: 'Quota WENKER Cloud quotidien' },
  'set.quotaLabel': { vi: 'Số lượt miễn phí cho mỗi tài khoản đăng nhập (mỗi ngày):', en: 'Free turns per login account (per day):', zh: '每个登录账号的免费次数（每日）：', fr: 'Tours gratuits par compte de connexion (par jour) :' },
  'set.quotaHelp': { vi: 'Áp dụng cho 9 tài khoản đăng nhập (mật khẩu 1–9) khi gọi model WENKER Cloud / Pollinations / DuckDuckGo. Khi hết lượt, API trả về 409 và người dùng có thể xem quảng cáo để nhận thêm 10 lượt (tối đa 30 lượt thưởng/ngày). Đặt 0 để không giới hạn. Giá trị mới có hiệu lực từ ngày kế tiếp với các tài khoản đã phát sinh hôm nay.', en: 'Applies to the 9 login accounts (passcodes 1–9) when calling WENKER Cloud / Pollinations / DuckDuckGo models. When out of turns, the API returns 409 and users can watch an ad for +10 turns (max 30 bonus/day). Set 0 for unlimited. New values take effect the next day for accounts already used today.', zh: '适用于调用 WENKER Cloud / Pollinations / DuckDuckGo 模型的 9 个登录账号（密码 1–9）。次数用尽时 API 返回 409，用户可观看广告获得 +10 次（每日最多 30 次奖励）。设为 0 表示不限。对今天已产生的账号，新值从次日起生效。', fr: 'S\u2019applique aux 9 comptes de connexion (codes 1–9) pour les modèles WENKER Cloud / Pollinations / DuckDuckGo. À court de tours, l\u2019API renvoie 409 et l\u2019utilisateur peut regarder une pub pour +10 tours (max 30 bonus/jour). 0 = illimité. Les nouvelles valeurs s\u2019appliquent dès le lendemain.' },
  'set.aboutTitle': { vi: 'Thông Tin Ứng Dụng', en: 'About', zh: '应用信息', fr: 'À propos' },
  'set.version': { vi: 'Phiên Bản', en: 'Version', zh: '版本', fr: 'Version' },
  'set.license': { vi: 'Bản Quyền', en: 'License', zh: '许可证', fr: 'Licence' },
  'set.licenseVal': { vi: 'Mã Nguồn Mở (MIT)', en: 'Open source (MIT)', zh: '开源（MIT）', fr: 'Open source (MIT)' },
  'set.protocol': { vi: 'Giao Thức', en: 'Protocol', zh: '协议', fr: 'Protocole' },
  'set.env': { vi: 'Môi Trường', en: 'Environment', zh: '环境', fr: 'Environnement' },

  // ---------- Model Finder ----------
  'mf.catAll': { vi: 'Tất cả', en: 'All', zh: '全部', fr: 'Tous' },
  'mf.catWenker': { vi: 'WENKER gốc', en: 'WENKER native', zh: 'WENKER 原生', fr: 'WENKER natif' },
  'mf.catFree': { vi: 'Miễn phí no-key', en: 'Free (no key)', zh: '免费（无密钥）', fr: 'Gratuit (sans clé)' },
  'mf.statusAlive': { vi: 'Đang sống', en: 'Live', zh: '存活', fr: 'Actif' },
  'mf.statusDown': { vi: 'Đã tắt', en: 'Down', zh: '已下线', fr: 'Hors ligne' },
  'mf.statusNeedsKey': { vi: 'Cần key', en: 'Needs key', zh: '需要密钥', fr: 'Clé requise' },
  'mf.statusUnknown': { vi: 'Chưa kiểm tra', en: 'Not checked', zh: '未检查', fr: 'Non vérifié' },
  'mf.searchPh': { vi: 'Ví dụ: lập trình python miễn phí không cần key / đọc tài liệu dài 1m / local trên máy tôi...', en: 'e.g. python coding free no key / read long 1m docs / local on my machine...', zh: '例如：免费无需密钥的 python 编程 / 阅读 1m 长文档 / 我本地的模型…', fr: 'ex. code python gratuit sans clé / lire de longs docs 1m / local sur ma machine...' },
  'mf.errServer': { vi: 'kiểm tra server đang chạy ở port 3600.', en: 'check the server is running on port 3600.', zh: '请检查服务器是否在 3600 端口运行。', fr: 'vérifiez que le serveur tourne sur le port 3600.' },
  'mf.onlyFree': { vi: 'Chỉ miễn phí (không cần key)', en: 'Free only (no key)', zh: '仅免费（无需密钥）', fr: 'Gratuits seulement (sans clé)' },
  'mf.onlyAlive': { vi: 'Chỉ nguồn đang sống', en: 'Live sources only', zh: '仅存活来源', fr: 'Sources actives seulement' },
  'mf.minContext': { vi: 'Context tối thiểu', en: 'Min context', zh: '最小上下文', fr: 'Contexte minimum' },
  'mf.noLimit': { vi: 'Không giới hạn', en: 'No limit', zh: '不限', fr: 'Aucune limite' },
  'mf.clearFilters': { vi: 'Xóa bộ lọc', en: 'Clear filters', zh: '清除筛选', fr: 'Effacer les filtres' },
  'mf.modelsMatch': { vi: 'model khớp', en: 'models match', zh: '个模型匹配', fr: 'modèles correspondent' },
  'mf.relaxed': { vi: ' • đã nới bộ lọc tự suy ra (không ai khớp tuyên đòi)', en: ' • auto-inferred filters relaxed (nothing matched the strict ask)', zh: ' • 已放宽自动推断的筛选（无严格匹配）', fr: ' • filtres déduits assouplis (aucune correspondance stricte)' },
  'mf.sortedFit': { vi: ' • xếp theo độ phù hợp', en: ' • sorted by relevance', zh: ' • 按相关度排序', fr: ' • trié par pertinence' },
  'mf.copyAliveTitle': { vi: 'Add-on: Copy All Live IDs', en: 'Add-on: copy all live IDs', zh: '附加：复制所有存活 ID', fr: 'Add-on : copier tous les ID actifs' },
  'mf.copyAliveBtn': { vi: 'Copy toàn bộ ID đang sống', en: 'Copy all live IDs', zh: '复制所有存活 ID', fr: 'Copier tous les ID actifs' },
  'mf.emptyTitle': { vi: 'Không tìm thấy model nào với bộ lọc hiện tại.', en: 'No models match the current filters.', zh: '当前筛选下未找到模型。', fr: 'Aucun modèle ne correspond aux filtres actuels.' },
  'mf.emptySub': { vi: 'Thử bỏ bộ lọc "chỉ nguồn đang sống", hoặc gọi ít từ hơn.', en: 'Try removing the "live sources only" filter, or use fewer words.', zh: '试试取消“仅存活来源”筛选，或减少关键词。', fr: 'Retirez le filtre « sources actives seulement » ou utilisez moins de mots.' },
  'mf.needKey': { vi: 'cần key', en: 'needs key', zh: '需密钥', fr: 'clé requise' },
  'mf.noKey': { vi: 'no key', en: 'no key', zh: '免密钥', fr: 'sans clé' },
  'mf.useNow': { vi: 'Dùng ngay', en: 'Use now', zh: '立即使用', fr: 'Utiliser' },
  'mf.copyIdTitle': { vi: 'Copy chỉ tên model (không prefix)', en: 'Copy model name only (no prefix)', zh: '仅复制模型名（无前缀）', fr: 'Copier le nom du modèle seul (sans préfixe)' },
  'mf.openProviderTitle': { vi: 'Mở trang nhà cung cấp', en: 'Open provider page', zh: '打开服务商页面', fr: 'Ouvrir la page du fournisseur' },
  'mf.showMore': { vi: 'Xem thêm {n} model', en: 'Show {n} more models', zh: '再显示 {n} 个模型', fr: 'Afficher {n} modèles de plus' },
  'mf.tipLabel': { vi: 'Mẹo:', en: 'Tip:', zh: '提示：', fr: 'Astuce :' },
  'mf.tipBody': { vi: 'gõ "code miễn phí", "đọc tài liệu dài 1m", "local", "reasoning" — WENKER tự dịch ra bộ lọc. Model trả về theo provider/model là gọi được ngay qua /v1/chat/completions.', en: 'type "code free", "read long 1m docs", "local", "reasoning" — WENKER translates them into filters. Models returned as provider/model work right away via /v1/chat/completions.', zh: '输入“code free”“read long 1m docs”“local”“reasoning”——WENKER 自动转换为筛选。以 provider/model 返回的模型可直接通过 /v1/chat/completions 调用。', fr: 'tapez « code free », « read long 1m docs », « local », « reasoning » — WENKER les traduit en filtres. Les modèles renvoyés en provider/model s\u2019appellent directement via /v1/chat/completions.' },
  'mf.addon': { vi: 'add-on', en: 'add-on', zh: '附加', fr: 'add-on' },
  'mf.modelsSources': { vi: '{n} model / {m} nguồn', en: '{n} models / {m} sources', zh: '{n} 模型 / {m} 来源', fr: '{n} modèles / {m} sources' },
  'mf.aliveCount': { vi: '{n} sống', en: '{n} live', zh: '{n} 存活', fr: '{n} actifs' },
  'mf.freeCount': { vi: '{n} miễn phí', en: '{n} free', zh: '{n} 免费', fr: '{n} gratuits' },
  'mf.reloadTitle': { vi: 'Tải lại danh mục', en: 'Reload catalog', zh: '重新加载目录', fr: 'Recharger le catalogue' },
  'mf.reload': { vi: 'Tải lại', en: 'Reload', zh: '重新加载', fr: 'Recharger' },
  'mf.probing': { vi: 'Đang gọi thử thật tới từng nguồn (khoảng 15-40 giây)...', en: 'Sending real test calls to each source (about 15-40 seconds)...', zh: '正在向每个来源发送真实测试（约 15-40 秒）…', fr: 'Appels réels vers chaque source (environ 15-40 secondes)...' },
  'mf.probeDone': { vi: 'Xong: {ok}/{n} nguồn trả lời thật.', en: 'Done: {ok}/{n} sources really answered.', zh: '完成：{ok}/{n} 个来源真实应答。', fr: 'Terminé : {ok}/{n} sources ont répondu.' },
  'mf.probeFail': { vi: 'Probe thất bại: {msg}', en: 'Probe failed: {msg}', zh: '探测失败：{msg}', fr: 'Échec du probe : {msg}' },
  'mf.errLoadModels': { vi: 'Không đọc được /v1/models', en: 'Could not read /v1/models', zh: '无法读取 /v1/models', fr: 'Impossible de lire /v1/models' },
  'mf.errConnect': { vi: 'Lỗi kết nối', en: 'Connection error', zh: '连接错误', fr: 'Erreur de connexion' },};

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
