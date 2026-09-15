/**
 * WENKER ROUTER - Catalog localization
 *
 * The provider catalog (providers-data.js) and the built-in add-on store
 * (addonService.js) ship Vietnamese-only `description` / `keyHelp` strings.
 * The console UI itself is fully i18n'd (vi/en/zh/fr), so after switching the
 * language away from Vietnamese, this catalog data was the last "wall of
 * Vietnamese" left in the app.
 *
 * This module keeps Vietnamese as the source of truth and stores EN/ZH/FR
 * translations keyed by provider / add-on id. Anything without a translation
 * (e.g. user-defined custom providers) falls back to the original string.
 *
 * The client sends the active UI language in the `x-wenker-lang` header
 * (see client/src/session.jsx authFetch); routes/admin.js applies
 * localizeProvider()/localizeAddon() before serializing the response.
 */

const UI_LANGS = ['vi', 'en', 'zh', 'fr'];

function resolveLang(headerValue) {
  const l = String(headerValue || 'vi').toLowerCase();
  return UI_LANGS.includes(l) ? l : 'vi';
}

// ~77 placeholder providers share one templated sentence:
//   "Cổng kết nối tự động cho <Name> với Base URL chuẩn."
// Translate via pattern instead of 77 dictionary entries.
const AUTO_CONNECT = /^Cổng kết nối tự động cho (.+) với Base URL chuẩn\.$/;
const AUTO_CONNECT_T = {
  en: (x) => `Auto-connect gateway for ${x} with a standard Base URL.`,
  zh: (x) => `为 ${x} 提供标准 Base URL 的自动连接网关。`,
  fr: (x) => `Passerelle de connexion automatique pour ${x} avec une Base URL standard.`
};

const DESCRIPTIONS = {
  'wenker-cloud': {
    en: 'Free queue with no API key. NOTE: the model id is the name you CALL (an alias); the model that ACTUALLY answers is the targetModel shown in the display name and the wenker_served_by field of /v1/models. When the upstream changes, the answer may come from a different model than the one you called.',
    zh: '免费队列,无需 API 密钥。注意:模型 id 是你调用的名称(别名);实际回答的模型是显示名称中的 targetModel 以及 /v1/models 里的 wenker_served_by 字段。上游变更时,回答可能来自与你所调用名称不同的模型。',
    fr: 'File d’attente gratuite sans clé API. À NOTER : l’id du modèle est le nom APPELÉ (un alias) ; le modèle qui RÉPOND réellement est le targetModel visible dans le nom d’affichage et le champ wenker_served_by de /v1/models. Quand l’amont change, la réponse peut provenir d’un modèle différent de celui appelé.'
  },
  'duckduckgo': {
    en: 'Anonymous DuckDuckGo Chat AI service, 100% free, no account or API key required.',
    zh: 'DuckDuckGo 匿名聊天 AI 服务,100% 免费,无需账号或 API 密钥。',
    fr: 'Service DuckDuckGo Chat IA anonyme, 100 % gratuit, sans compte ni clé API.'
  },
  'pollinations': {
    en: 'Open free AI API with no limits, no API key required, supports text & image streaming.',
    zh: '开放免费 AI API,无限制,无需 API 密钥,支持文本与图像流式输出。',
    fr: 'API IA ouverte gratuite et illimitée, sans clé API, avec streaming texte et image.'
  },
  'huggingchat-free': {
    en: 'Free community HuggingChat with Llama, Qwen, DeepSeek.',
    zh: '免费社区版 HuggingChat,支持 Llama、Qwen、DeepSeek。',
    fr: 'HuggingChat communautaire gratuit avec Llama, Qwen, DeepSeek.'
  },
  'cloudflare-ai-free': {
    en: 'Cloudflare Workers AI gives 10,000 free neurons per day with dozens of open models.',
    zh: 'Cloudflare Workers AI 每天提供 10000 免费 neurons,含数十个开放模型。',
    fr: 'Cloudflare Workers AI offre 10 000 neurons gratuits par jour avec des dizaines de modèles ouverts.'
  },
  'puter-ai': {
    en: 'Puter.js AI Driver running on a free cloud environment for developers.',
    zh: 'Puter.js AI Driver 运行于面向开发者的免费云环境。',
    fr: 'Puter.js AI Driver exécuté sur un environnement cloud gratuit pour les développeurs.'
  },
  'blackbox-free': {
    en: 'Free AI coding platform with code search and automatic code generation.',
    zh: '免费 AI 编程平台,支持代码搜索与自动生成代码。',
    fr: 'Plateforme de code IA gratuite avec recherche de code et génération automatique.'
  },
  'cohere-free': {
    en: 'Cohere offers a Trial Key free for developers with no time limit.',
    zh: 'Cohere 为开发者提供不限时长的免费试用 Trial Key。',
    fr: 'Cohere propose une Trial Key gratuite et sans limite de durée pour les développeurs.'
  },
  'groq-free': {
    en: 'Groq LPU free tier at 500-1000 tokens/sec with DeepSeek R1 & Llama 3.3.',
    zh: 'Groq LPU 免费层,DeepSeek R1 与 Llama 3.3 速度达 500-1000 tokens/秒。',
    fr: 'Tier gratuit Groq LPU à 500-1000 tokens/s avec DeepSeek R1 et Llama 3.3.'
  },
  'openai': {
    en: 'Official OpenAI GPT-4o, o1, o3-mini, GPT-4o-mini.',
    zh: 'OpenAI 官方 GPT-4o、o1、o3-mini、GPT-4o-mini。',
    fr: 'OpenAI officiel : GPT-4o, o1, o3-mini, GPT-4o-mini.'
  },
  'anthropic': {
    en: 'Claude 3.7 Sonnet with Hybrid Reasoning, Claude 3.5 Haiku, Claude 3 Opus.',
    zh: 'Claude 3.7 Sonnet(混合推理)、Claude 3.5 Haiku、Claude 3 Opus。',
    fr: 'Claude 3.7 Sonnet avec Hybrid Reasoning, Claude 3.5 Haiku, Claude 3 Opus.'
  },
  'google-gemini': {
    en: 'Google Gemini 2.5 Pro, 2.0 Flash with a huge 2M-token context and a generous free tier.',
    zh: 'Google Gemini 2.5 Pro、2.0 Flash,拥有 200 万 token 超大上下文和宽裕的免费层。',
    fr: 'Google Gemini 2.5 Pro, 2.0 Flash avec un contexte géant de 2 M de tokens et un tier gratuit généreux.'
  },
  'google-vertex': {
    en: 'Enterprise-grade Vertex AI platform from Google Cloud.',
    zh: 'Google Cloud 企业级 Vertex AI 平台。',
    fr: 'Plateforme Vertex AI de niveau entreprise de Google Cloud.'
  },
  'xai': {
    en: 'Grok-2, Grok-2-vision, Grok Beta from Elon Musk’s xAI.',
    zh: 'Elon Musk 旗下 xAI 的 Grok-2、Grok-2-vision、Grok Beta。',
    fr: 'Grok-2, Grok-2-vision, Grok Beta de xAI, la société d’Elon Musk.'
  },
  'azure-openai': {
    en: 'OpenAI service deployed securely on Microsoft Azure infrastructure.',
    zh: '在 Microsoft Azure 基础设施上安全部署的 OpenAI 服务。',
    fr: 'Service OpenAI déployé en toute sécurité sur l’infrastructure Microsoft Azure.'
  },
  'aws-bedrock': {
    en: 'Amazon Web Services Bedrock offering Claude, Llama, Amazon Titan.',
    zh: 'AWS Bedrock,提供 Claude、Llama、Amazon Titan。',
    fr: 'Amazon Web Services Bedrock avec Claude, Llama, Amazon Titan.'
  },
  'github-models': {
    en: 'GitHub Models lets developers use GPT-4o, Claude, DeepSeek for free with a GitHub PAT token.',
    zh: 'GitHub Models 允许开发者凭 GitHub PAT 令牌免费使用 GPT-4o、Claude、DeepSeek。',
    fr: 'GitHub Models permet aux développeurs d’utiliser gratuitement GPT-4o, Claude, DeepSeek via un token PAT GitHub.'
  },
  'groq': {
    en: 'The fastest inference on the planet on LPU Tensor Streaming Processor chips.',
    zh: '基于 LPU 张量流处理器芯片的地球最快推理。',
    fr: 'L’inférence la plus rapide de la planète sur des puces LPU Tensor Streaming Processor.'
  },
  'cerebras': {
    en: 'Extreme-speed inference at 2000+ tokens/sec on the Wafer-Scale Engine CS-3.',
    zh: 'Wafer-Scale Engine CS-3 上的极速推理,2000+ tokens/秒。',
    fr: 'Inférence à vitesse extrême, 2000+ tokens/s sur le Wafer-Scale Engine CS-3.'
  },
  'sambanova': {
    en: 'Run DeepSeek R1 671B full precision at hundreds of tokens per second.',
    zh: '以每秒数百 token 的速度运行全精度 DeepSeek R1 671B。',
    fr: 'Exécutez DeepSeek R1 671B pleine précision à plusieurs centaines de tokens par seconde.'
  },
  'together': {
    en: 'Together AI provides top GPU clusters running open source models.',
    zh: 'Together AI 提供运行开源模型的顶级 GPU 集群。',
    fr: 'Together AI fournit des clusters GPU de premier plan pour les modèles open source.'
  },
  'fireworks': {
    en: 'Inference platform optimized for compound AI systems and fast function calling.',
    zh: '针对复合 AI 系统与快速函数调用优化的推理平台。',
    fr: 'Plateforme d’inférence optimisée pour les systèmes d’IA composés et le function calling rapide.'
  },
  'deepinfra': {
    en: 'The lowest cost for open source models: DeepSeek, Llama, Qwen, Whisper, SDXL.',
    zh: '开源模型最低成本:DeepSeek、Llama、Qwen、Whisper、SDXL。',
    fr: 'Le coût le plus bas pour les modèles open source : DeepSeek, Llama, Qwen, Whisper, SDXL.'
  },
  'novita': {
    en: 'Novita AI GPU cloud inference for LLMs and Stable Diffusion.',
    zh: 'Novita AI GPU 云推理,支持 LLM 与 Stable Diffusion。',
    fr: 'Inférence cloud GPU Novita AI pour LLM et Stable Diffusion.'
  },
  'siliconflow': {
    en: 'Major Asian inference platform, grants many free tokens for DeepSeek R1, V3 and Qwen.',
    zh: '亚洲大型推理平台,为 DeepSeek R1、V3 和 Qwen 赠送大量免费 token。',
    fr: 'Grande plateforme d’inférence asiatique offrant de nombreux tokens gratuits pour DeepSeek R1, V3 et Qwen.'
  },
  'lepton': {
    en: 'Serverless AI cloud platform by the creator of PyTorch.',
    zh: '由 PyTorch 创始人打造的无服务器 AI 云平台。',
    fr: 'Plateforme AI cloud serverless du créateur de PyTorch.'
  },
  'hyperbolic': {
    en: 'Decentralized open compute network for open-access AI inference.',
    zh: '面向开放 AI 推理的去中心化开放计算网络。',
    fr: 'Réseau de calcul ouvert décentralisé pour l’inférence IA en libre accès.'
  },
  'friendliai': {
    en: 'Ultra-fast throughput and latency optimization via the Friendli Engine.',
    zh: '通过 Friendli Engine 实现超高吞吐与延迟优化。',
    fr: 'Optimisation ultra-rapide du débit et de la latence via le moteur Friendli.'
  },
  'openrouter': {
    en: 'Aggregator gateway to hundreds of global models, both free and paid.',
    zh: '聚合全球数百个模型的网关,免费与付费兼有。',
    fr: 'Passerelle agrégeant des centaines de modèles mondiaux, gratuits et payants.'
  },
  'replicate': {
    en: 'Run open source models on the cloud with one command or API call.',
    zh: '用一条命令或一次 API 调用在云端运行开源模型。',
    fr: 'Exécutez des modèles open source sur le cloud en une commande ou un appel API.'
  },
  'huggingface': {
    en: 'Hugging Face Serverless Inference API for thousands of model repos.',
    zh: 'Hugging Face 无服务器推理 API,支持数千模型仓库。',
    fr: 'API Serverless Inference de Hugging Face pour des milliers de dépôts de modèles.'
  },
  'mistral': {
    en: 'Mistral Large 2, Codestral, Pixtral and Mistral NeMo, from France.',
    zh: '来自法国的 Mistral Large 2、Codestral、Pixtral 和 Mistral NeMo。',
    fr: 'Mistral Large 2, Codestral, Pixtral et Mistral NeMo, depuis la France.'
  },
  'cohere': {
    en: 'Enterprise language models specialized in RAG and reranking.',
    zh: '专注 RAG 与重排的企业级语言模型。',
    fr: 'Modèles de langage d’entreprise spécialisés dans le RAG et le reranking.'
  },
  'perplexity': {
    en: 'Search-and-cite models pulling information live from the internet (Sonar).',
    zh: '直接从互联网检索并引用信息的模型(Sonar)。',
    fr: 'Modèles de recherche et citation en direct depuis Internet (Sonar).'
  },
  'ai21': {
    en: 'Jamba architecture, a hybrid of Transformer and Mamba state-space.',
    zh: 'Jamba 架构:Transformer 与 Mamba 状态空间的混合。',
    fr: 'Architecture Jamba, hybride de Transformer et d’espace d’états Mamba.'
  },
  'aleph-alpha': {
    en: 'European enterprise AI compliant with EU AI Act security standards.',
    zh: '符合欧盟 AI 法案安全标准的欧洲企业 AI。',
    fr: 'IA d’entreprise européenne conforme aux normes de sécurité de l’EU AI Act.'
  },
  'jina-ai': {
    en: 'Specialized in embeddings, rerankers and a Reader API that turns URLs into Markdown.',
    zh: '专精 embeddings、重排器以及把 URL 转成 Markdown 的 Reader API。',
    fr: 'Spécialisé embeddings, rerankers et Reader API qui transforme les URL en Markdown.'
  },
  'voyage-ai': {
    en: 'Top-quality embeddings and rerank for vector search systems.',
    zh: '面向向量检索系统的最高质量 embeddings 与重排。',
    fr: 'Embeddings et rerank de très haute qualité pour la recherche vectorielle.'
  },
  'deepseek': {
    en: 'Official API gateway for DeepSeek R1 and DeepSeek V3 at extremely competitive prices.',
    zh: 'DeepSeek R1 与 DeepSeek V3 官方 API 网关,价格极具竞争力。',
    fr: 'Passerelle API officielle de DeepSeek R1 et DeepSeek V3 à des prix très compétitifs.'
  },
  'moonshot-kimi': {
    en: 'Kimi AI, famous for ultra-long context reading and excellent Chinese/English reasoning.',
    zh: 'Kimi AI 以超长上下文阅读与出色的中英推理能力闻名。',
    fr: 'Kimi AI, réputé pour la lecture de contextes très longs et son raisonnement chinois/anglais.'
  },
  'zhipu-glm': {
    en: 'GLM-4 Plus, GLM-4-Flash, GLM-4V, CogView from Tsinghua University & Zhipu.',
    zh: '清华大学与智谱的 GLM-4 Plus、GLM-4-Flash、GLM-4V、CogView。',
    fr: 'GLM-4 Plus, GLM-4-Flash, GLM-4V, CogView de l’université Tsinghua et de Zhipu.'
  },
  'qwen-dashscope': {
    en: 'Qwen 2.5 Max, Qwen 2.5 Coder, Qwen-Plus from Alibaba Cloud.',
    zh: '阿里云的 Qwen 2.5 Max、Qwen 2.5 Coder、Qwen-Plus。',
    fr: 'Qwen 2.5 Max, Qwen 2.5 Coder, Qwen-Plus d’Alibaba Cloud.'
  },
  'baichuan': {
    en: 'Baichuan 4 and Baichuan 3 Turbo optimized for natural language processing.',
    zh: '百川 4 与百川 3 Turbo,针对自然语言处理优化。',
    fr: 'Baichuan 4 et Baichuan 3 Turbo optimisés pour le traitement du langage naturel.'
  },
  'minimax': {
    en: 'MiniMax abab 6.5s and advanced Audio AI voice technology.',
    zh: 'MiniMax abab 6.5s 与先进的 Audio AI 语音技术。',
    fr: 'MiniMax abab 6.5s et technologie vocale Audio AI de pointe.'
  },
  'bytedance-doubao': {
    en: 'ByteDance’s Doubao models (TikTok’s parent company), among the cheapest on the market.',
    zh: '字节跳动(抖音母公司)的 Doubao 模型,市场价格最低之一。',
    fr: 'Les modèles Doubao de ByteDance (maison mère de TikTok), parmi les moins chers du marché.'
  },
  'zero-one-yi': {
    en: 'Yi-Lightning and Yi-Large from Dr. Kai-Fu Lee.',
    zh: '李开复博士的 Yi-Lightning 与 Yi-Large。',
    fr: 'Yi-Lightning et Yi-Large du Dr Kai-Fu Lee.'
  },
  'stepfun': {
    en: 'Step-2 and Step-1V multimodal language and vision models.',
    zh: 'Step-2 与 Step-1V 语言+图像多模态模型。',
    fr: 'Step-2, Step-1V : modèles multimodaux langage et vision.'
  },
  'baidu-qianfan': {
    en: 'ERNIE 4.0 Turbo and free ERNIE Speed from Baidu.',
    zh: '百度的 ERNIE 4.0 Turbo 与免费的 ERNIE Speed。',
    fr: 'ERNIE 4.0 Turbo et ERNIE Speed gratuit de Baidu.'
  },
  'tencent-hunyuan': {
    en: 'Hunyuan-Large and Hunyuan-Pro from the Tencent group.',
    zh: '腾讯集团的 Hunyuan-Large 与 Hunyuan-Pro。',
    fr: 'Hunyuan-Large et Hunyuan-Pro du groupe Tencent.'
  },
  'sensetime': {
    en: 'SenseNova 5.5, a leading Chinese MoE architecture.',
    zh: '商汤 SenseNova 5.5,中国领先的 MoE 架构。',
    fr: 'SenseNova 5.5, architecture MoE de premier plan en Chine.'
  },
  'iflytek-spark': {
    en: 'Spark 4.0 Ultra, specialized in speech processing and multilingual translation.',
    zh: '讯飞 Spark 4.0 Ultra,专精语音处理与多语言翻译。',
    fr: 'Spark 4.0 Ultra, spécialisé dans le traitement de la parole et la traduction multilingue.'
  },
  'ollama': {
    en: 'Run local models on your machine (Llama 3, DeepSeek, Qwen) without internet.',
    zh: '在本地电脑运行模型(Llama 3、DeepSeek、Qwen),无需联网。',
    fr: 'Exécutez des modèles en local sur votre machine (Llama 3, DeepSeek, Qwen) sans Internet.'
  },
  'lmstudio': {
    en: 'GUI and OpenAI-compatible local server for running GGUF files.',
    zh: '运行 GGUF 文件的图形界面与 OpenAI 兼容本地服务器。',
    fr: 'Interface graphique et serveur local compatible OpenAI pour exécuter les fichiers GGUF.'
  },
  'vllm': {
    en: 'The fastest LLM serving library with PagedAttention.',
    zh: '搭载 PagedAttention 的最快 LLM 服务库。',
    fr: 'La bibliothèque de service LLM la plus rapide avec PagedAttention.'
  },
  'localai': {
    en: 'OpenAI-compatible drop-in replacement for LLMs, audio and vision without a GPU.',
    zh: '无需 GPU 的 OpenAI 兼容即插即用替代方案(LLM、音频、图像)。',
    fr: 'Remplacement drop-in compatible OpenAI pour LLM, audio et vision sans GPU.'
  },
  'jan-ai': {
    en: 'Open-source ChatGPT alternative running 100% offline on your machine.',
    zh: '开源 ChatGPT 替代品,100% 离线运行于本机。',
    fr: 'Alternative open source à ChatGPT fonctionnant 100 % hors ligne sur votre machine.'
  },
  'text-generation-webui': {
    en: 'Popular WebUI supporting Transformers, GPTQ, AWQ, EXL2, llama.cpp.',
    zh: '流行的 WebUI,支持 Transformers、GPTQ、AWQ、EXL2、llama.cpp。',
    fr: 'WebUI populaire prenant en charge Transformers, GPTQ, AWQ, EXL2, llama.cpp.'
  },
  'koboldcpp': {
    en: 'Simple, lightweight GGUF model runner with a built-in Web UI.',
    zh: '简单轻量的 GGUF 模型运行器,内置 Web UI。',
    fr: 'Exécuteur de modèles GGUF simple et léger avec Web UI intégrée.'
  },
  'llamacpp': {
    en: 'Pure C/C++ ultra-light server for LLM inference on CPU and GPU.',
    zh: '纯 C/C++ 超轻量服务器,在 CPU 与 GPU 上推理 LLM。',
    fr: 'Serveur C/C++ pur ultra-léger pour l’inférence LLM sur CPU et GPU.'
  },
  'tabby': {
    en: 'Self-contained self-hosted code assistant (self-hosted alternative to GitHub Copilot).',
    zh: '自成一体的自托管 AI 编程助手(GitHub Copilot 的自托管替代)。',
    fr: 'Assistant de code auto-hébergé autonome (alternative self-hosted à GitHub Copilot).'
  },
  'sglang': {
    en: 'Fast serving system with RadixAttention sharing the KV cache.',
    zh: '基于 RadixAttention 共享 KV 缓存的快速服务系统。',
    fr: 'Système de service rapide avec RadixAttention qui partage le cache KV.'
  },
  'aphrodite': {
    en: 'Inference engine optimized for creative writing and roleplay conversations.',
    zh: '面向创意写作与角色扮演对话优化的推理引擎。',
    fr: 'Moteur d’inférence optimisé pour l’écriture créative et le jeu de rôle conversationnel.'
  },
  'xinference': {
    en: 'Distributed AI model serving for LLMs, embeddings and multimodal.',
    zh: '面向 LLM、embeddings 与多模态的分布式模型服务。',
    fr: 'Service distribué de modèles IA pour LLM, embeddings et multimodal.'
  },
  'claude-code': {
    en: 'Anthropic `/v1/messages` protocol, perfectly compatible with the Claude Code CLI.',
    zh: 'Anthropic `/v1/messages` 协议,与 Claude Code 命令行完全兼容。',
    fr: 'Protocole Anthropic `/v1/messages`, parfaitement compatible avec le CLI Claude Code.'
  },
  'codeium-windsurf': {
    en: 'Windsurf’s smart programming assistance and Cascade Agent.',
    zh: 'Windsurf 的智能编程辅助与 Cascade Agent。',
    fr: 'L’assistance de programmation intelligente de Windsurf et son agent Cascade.'
  },
  'sourcegraph-cody': {
    en: 'AI that understands your whole codebase and the project’s source graph.',
    zh: '理解整个代码库与项目源码图谱的 AI。',
    fr: 'IA qui comprend toute votre base de code et le graphe de sources du projet.'
  },
  'openhands-proxy': {
    en: 'Open-source autonomous coding agent (formerly OpenDevin).',
    zh: '开源自主编程 agent(前身为 OpenDevin)。',
    fr: 'Agent de programmation autonome open source (anciennement OpenDevin).'
  },
  'replit-agent': {
    en: 'Agent that builds fullstack apps from natural-language prompts.',
    zh: '根据自然语言提示构建全栈应用的 agent。',
    fr: 'Agent qui construit des applications fullstack à partir de prompts naturels.'
  },
  'phind-search': {
    en: 'Next-generation programming search and answer engine.',
    zh: '新一代编程问答搜索引擎。',
    fr: 'Moteur de recherche et de réponses de programmation nouvelle génération.'
  },
  'oracle-oci-ai': {
    en: 'Next-generation AI services on the Oracle OCI platform.',
    zh: 'Oracle OCI 平台上的新一代 AI 服务。',
    fr: 'Services IA de nouvelle génération sur la plateforme Oracle OCI.'
  },
  'ibm-watsonx': {
    en: 'IBM’s Granite enterprise AI platform.',
    zh: 'IBM 的 Granite 企业 AI 平台。',
    fr: 'Plateforme IA d’entreprise Granite d’IBM.'
  },
  'databricks-serving': {
    en: 'Deploy LLMs on Databricks’ Lakehouse.',
    zh: '在 Databricks 的 Lakehouse 上部署 LLM。',
    fr: 'Déployez des LLM sur le Lakehouse de Databricks.'
  },
  'snowflake-cortex': {
    en: 'AI integrated directly into Snowflake’s Data Cloud.',
    zh: '直接集成进 Snowflake Data Cloud 的 AI。',
    fr: 'IA intégrée directement dans le Data Cloud de Snowflake.'
  },
  'nim-nvidia': {
    en: 'Microservices maximally optimized for NVIDIA GPUs, with 1000 free credits.',
    zh: '针对 NVIDIA GPU 深度优化的微服务,赠送 1000 credits。',
    fr: 'Microservices ultra-optimisés pour GPU NVIDIA, avec 1000 crédits offerts.'
  },
  'anyscale': {
    en: 'Large-scale model serving on Ray.',
    zh: '基于 Ray 的大规模模型服务。',
    fr: 'Service de modèles à grande échelle sur Ray.'
  },
  'upstage': {
    en: 'Solar Pro models, excellent at document processing and OCR, from Korea.',
    zh: '韩国 Solar Pro 模型,文档处理与 OCR 表现出色。',
    fr: 'Modèles Solar Pro venus de Corée, excellents en traitement de documents et OCR.'
  },
  'aihubmix': {
    en: 'Aggregated API gateway with cheap multi-channel routing.',
    zh: '多渠道低价聚合 API 网关。',
    fr: 'Passerelle API agrégée à routage multi-canaux économique.'
  },
  'nanogpt': {
    en: 'Pay per prompt with Nano crypto / anonymous currency.',
    zh: '使用 Nano 加密货币按 prompt 匿名付费。',
    fr: 'Paiement par prompt en crypto Nano / devise anonyme.'
  },
  'kluster-ai': {
    en: 'High-speed inference clusters distributed globally.',
    zh: '全球分布的高速推理集群。',
    fr: 'Clusters d’inférence haute vitesse répartis à l’échelle mondiale.'
  },
  'baseten': {
    en: 'Serverless infrastructure inference with Truss packaging.',
    zh: '无服务器基础设施推理与 Truss 打包。',
    fr: 'Inférence sur infrastructure serverless avec packaging Truss.'
  },
  'modal': {
    en: 'Cloud computing for AI driven by pure Python code.',
    zh: '用纯 Python 代码驱动的 AI 云计算。',
    fr: 'Calcul cloud pour l’IA piloté en pur code Python.'
  },
  'runpod': {
    en: 'Serverless GPU pods billed per second of use.',
    zh: '按使用秒数计费的无服务器 GPU pod。',
    fr: 'Pods GPU serverless facturés à la seconde d’utilisation.'
  },
  'monsterapi': {
    en: 'Up to 80% cost optimization for LLM fine-tuning and inference.',
    zh: 'LLM 微调与推理成本最多优化 80%。',
    fr: 'Jusqu’à 80 % d’optimisation de coûts pour le fine-tuning et l’inférence LLM.'
  },
  'featherless': {
    en: 'Call 1000+ open source Hugging Face models on demand.',
    zh: '按需调用 1000+ 个 Hugging Face 开源模型。',
    fr: 'Appelez à la demande plus de 1000 modèles open source Hugging Face.'
  },
  'predibase': {
    en: 'High-speed LoRA adapter serving platform with LoRAX.',
    zh: '基于 LoRAX 的高速 LoRA 适配器服务平台。',
    fr: 'Plateforme de service d’adaptateurs LoRA à haute vitesse avec LoRAX.'
  },
  'lamini': {
    en: 'Enterprise LLM engine specialized for business and finance.',
    zh: '面向商业与金融的企业级 LLM 引擎。',
    fr: 'Moteur LLM d’entreprise spécialisé pour les affaires et la finance.'
  },
  'clarifai': {
    en: 'Computer vision and multimodal generative AI platform.',
    zh: '计算机视觉与多模态生成式 AI 平台。',
    fr: 'Plateforme de vision par ordinateur et d’IA générative multimodale.'
  },
  'aimlapi': {
    en: 'Unified gateway to 200+ AI models with transparent pricing.',
    zh: '统一访问 200+ 个 AI 模型,价格透明。',
    fr: 'Passerelle unifiée vers plus de 200 modèles IA à tarification transparente.'
  },
  'helicone': {
    en: 'Smart proxy with logging, caching and LLM cost analytics.',
    zh: '带日志、缓存与 LLM 成本分析的智能代理。',
    fr: 'Proxy intelligent avec logs, cache et analyse des coûts LLM.'
  },
  'portkey': {
    en: 'Production-grade AI gateway with load balancing, fallbacks and guardrails.',
    zh: '生产级 AI 网关:负载均衡、回退与护栏。',
    fr: 'Passerelle IA de niveau production avec équilibrage de charge, fallbacks et garde-fous.'
  },
  'lunary': {
    en: 'Testing and agent-monitoring platform for LLM applications.',
    zh: '面向 LLM 应用的测试与 agent 监控平台。',
    fr: 'Plateforme de test et de supervision d’agents pour applications LLM.'
  },
  'openwebui-proxy': {
    en: 'Direct connection to the backend of an OpenWebUI server cluster.',
    zh: '直连 OpenWebUI 服务器集群的后端。',
    fr: 'Connexion directe au backend d’un cluster de serveurs OpenWebUI.'
  },
  'librechat-proxy': {
    en: 'Leading open-source multi-provider chat interface.',
    zh: '领先的开源多提供商聊天界面。',
    fr: 'Interface de chat multi-fournisseurs open source de premier plan.'
  },
  'dify-ai': {
    en: 'Open-source platform for LLM app development and RAG workflows.',
    zh: '开源 LLM 应用开发与 RAG 工作流平台。',
    fr: 'Plateforme open source de développement d’applications LLM et de workflows RAG.'
  },
  'fastchat': {
    en: 'Open-source platform to train and serve LLMs, by LMSYS Org.',
    zh: 'LMSYS Org 的开源 LLM 训练与服务平台。',
    fr: 'Plateforme open source d’entraînement et de service de LLM par LMSYS Org.'
  },
  'tgi-huggingface': {
    en: 'Hugging Face’s production-optimized LLM server.',
    zh: 'Hugging Face 面向生产环境优化的 LLM 服务器。',
    fr: 'Serveur LLM optimisé pour la production par Hugging Face.'
  },
  'openllm': {
    en: 'Run any LLM in a production environment with ease.',
    zh: '轻松在生产环境运行任意 LLM。',
    fr: 'Faites tourner n’importe quel LLM en production en toute simplicité.'
  },
  'triton-inference': {
    en: 'NVIDIA multi-framework inference server (PyTorch, TensorRT-LLM, ONNX).',
    zh: 'NVIDIA 多框架推理服务器(PyTorch、TensorRT-LLM、ONNX)。',
    fr: 'Serveur d’inférence multi-framework de NVIDIA (PyTorch, TensorRT-LLM, ONNX).'
  },
  'firecrawl': {
    en: 'Turn entire websites into clean Markdown for LLMs.',
    zh: '把整个网站转换为干净的 Markdown 供 LLM 使用。',
    fr: 'Transformez des sites web entiers en Markdown propre pour les LLM.'
  },
  'tavily-search': {
    en: 'Internet search tool built for AI agents and RAG, 1000 free searches/month.',
    zh: '为 AI agent 与 RAG 而生的互联网搜索工具,每月 1000 次免费搜索。',
    fr: 'Outil de recherche Internet conçu pour les agents IA et le RAG, 1000 recherches gratuites/mois.'
  },
  'exa-ai': {
    en: 'Search by embedding vectors, matching the meaning of text directly.',
    zh: '通过向量 embeddings 直接按文本语义搜索。',
    fr: 'Recherche par vecteurs d’embeddings, directement par le sens du texte.'
  },
  'unsloth-ai': {
    en: '5x faster training and inference, saving 80% of VRAM.',
    zh: '训练与推理提速 5 倍,节省 80% 显存。',
    fr: 'Entraînement et inférence 5x plus rapides, 80 % de VRAM économisée.'
  },
  'nomic-ai': {
    en: 'Nomic Embed Text with an 8192 context window, fully open.',
    zh: 'Nomic Embed Text 完全开放,支持 8192 上下文窗口。',
    fr: 'Nomic Embed Text entièrement ouvert avec une fenêtre de contexte de 8192.'
  },
  'wenker-vip': {
    en: 'WENKER’s dedicated premium bandwidth for Claude Code and Cursor.',
    zh: 'WENKER 面向 Claude Code 与 Cursor 的专用高级带宽。',
    fr: 'Bande passante premium dédiée WENKER pour Claude Code et Cursor.'
  }
};

const KEY_HELP = {
  'wenker-cloud': {
    en: 'Free, no key needed. However the anonymous Pollinations tier is currently out of budget (HTTP 402). To revive it: go to https://enter.pollinations.ai/keys, register for free (GitHub login) → create an API key → paste it into the “API Key” field here.',
    zh: '免费,无需密钥。但 Pollinations 匿名层目前已耗尽预算(HTTP 402)。恢复方法:前往 https://enter.pollinations.ai/keys 免费注册(GitHub 登录)→ 创建 API 密钥 → 粘贴到这里的“API Key”输入框。',
    fr: 'Gratuit, sans clé. Cependant le tier anonyme de Pollinations est actuellement à court de budget (HTTP 402). Pour le relancer : allez sur https://enter.pollinations.ai/keys, inscrivez-vous gratuitement (login GitHub) → créez une clé API → collez-la dans le champ « API Key » ici.'
  },
  'groq-free': {
    en: 'Free key, no card: console.groq.com -> Login (Google/GitHub) -> API Keys -> Create API Key.',
    zh: '免费密钥,无需信用卡:console.groq.com -> 登录(Google/GitHub)-> API Keys -> Create API Key。',
    fr: 'Clé gratuite sans carte : console.groq.com -> Connexion (Google/GitHub) -> API Keys -> Créer une clé API.'
  },
  'google-gemini': {
    en: 'Free key, no card: aistudio.google.com -> Get API key (Google sign-in) -> Create API key.',
    zh: '免费密钥,无需信用卡:aistudio.google.com -> 获取 API 密钥(登录 Google)-> Create API key。',
    fr: 'Clé gratuite sans carte : aistudio.google.com -> Obtenir une clé API (connexion Google) -> Créer une clé API.'
  },
  'github-models': {
    en: 'Use a classic GitHub Personal Access Token (scope models:read): github.com -> Settings -> Developer settings -> Tokens (classic) -> Generate. Free, no card.',
    zh: '使用 classic 类型的 GitHub 个人访问令牌(scope models:read):github.com -> Settings -> Developer settings -> Tokens (classic)-> Generate。免费,无需信用卡。',
    fr: 'Utilisez un Personal Access Token GitHub de type classic (scope models:read) : github.com -> Settings -> Developer settings -> Tokens (classic) -> Generate. Gratuit, sans carte.'
  },
  'groq': {
    en: 'Free key, no card: console.groq.com -> Login (Google/GitHub) -> API Keys -> Create API Key.',
    zh: '免费密钥,无需信用卡:console.groq.com -> 登录(Google/GitHub)-> API Keys -> Create API Key。',
    fr: 'Clé gratuite sans carte : console.groq.com -> Connexion (Google/GitHub) -> API Keys -> Créer une clé API.'
  },
  'cerebras': {
    en: 'Free key: cloud.cerebras.ai -> Login -> API Keys -> Create.',
    zh: '免费密钥:cloud.cerebras.ai -> 登录 -> API Keys -> 创建。',
    fr: 'Clé gratuite : cloud.cerebras.ai -> Connexion -> API Keys -> Créer.'
  },
  'sambanova': {
    en: 'Free key: cloud.sambanova.ai -> Sign Up -> API Key (top-right corner).',
    zh: '免费密钥:cloud.sambanova.ai -> 注册 -> API Key(右上角)。',
    fr: 'Clé gratuite : cloud.sambanova.ai -> Sign Up -> clé API (en haut à droite).'
  },
  'openrouter': {
    en: 'Free key, no trusted card: openrouter.ai -> Login -> Keys -> Create Key. Then just append “:free” to the model name (e.g. openrouter/meta-llama/llama-3.3-70b-instruct:free).',
    zh: '免费密钥,无需可信信用卡:openrouter.ai -> 登录 -> Keys -> 创建密钥。之后只需在模型名后加上 “:free”(如 openrouter/meta-llama/llama-3.3-70b-instruct:free)。',
    fr: 'Clé gratuite sans carte fiable : openrouter.ai -> Connexion -> Keys -> Créer une clé. Il suffit ensuite d’ajouter « :free » au nom du modèle (ex. openrouter/meta-llama/llama-3.3-70b-instruct:free).'
  },
  'nim-nvidia': {
    en: 'Free key, no card: build.nvidia.com -> Login -> Get API Key (1000 free credits granted, generous rate limit).',
    zh: '免费密钥,无需信用卡:build.nvidia.com -> 登录 -> 获取 API Key(赠送 1000 免费 credits,速率限制宽松)。',
    fr: 'Clé gratuite sans carte : build.nvidia.com -> Connexion -> Obtenir une clé API (1000 crédits offerts, rate limit généreuse).'
  }
};

const ADDON_DESCRIPTIONS = {
  'wenker.theme.midnight': {
    en: 'Original corner theme: dark blue-black background, cyan accent - classic glassmorphism.',
    zh: '原点主题:蓝黑深色背景、青色强调色 —— 经典玻璃拟态。',
    fr: 'Thème d’origine : fond bleu nuit sombre, accent cyan - glassmorphism classique.'
  },
  'wenker.theme.emerald': {
    en: 'Emerald green on a snow-black background, hacker terminal style.',
    zh: '雪黑背景上的翠绿色,黑客终端风格。',
    fr: 'Vert émeraude sur fond noir de neige, style terminal hacker.'
  },
  'wenker.theme.synthwave': {
    en: 'Neon pink-purple retro-80s, high contrast, very rounded corners.',
    zh: '霓虹粉紫复古 80 年代风,高对比,大圆角。',
    fr: 'Rose-violet néon rétro-80s, contraste élevé, coins très arrondis.'
  },
  'wenker.theme.contrast': {
    en: 'Maximum contrast for readability: black background, bright sky-blue accent.',
    zh: '为便于阅读的最高对比度:黑色背景、明亮天蓝强调色。',
    fr: 'Contraste maximal pour la lisibilité : fond noir, accent bleu ciel lumineux.'
  },
  'wenker.theme.ember': {
    en: 'Warm amber on a dark brown background, easy on the eyes for night shifts.',
    zh: '深棕背景上的暖琥珀色,夜班护眼。',
    fr: 'Ambre chaud sur fond brun sombre, doux pour les yeux en poste de nuit.'
  },
  'wenker.addon.copyids': {
    en: 'Adds a “Copy all live IDs” button inside Model Finder.',
    zh: '在 Model Finder 中添加“复制全部在线 ID”按钮。',
    fr: 'Ajoute un bouton « Copier tous les ID actifs » dans Model Finder.'
  }
};

// Default description that dbService writes for user-created custom providers
// when none was supplied. Localize it too so a non-VI UI never shows it raw.
const DEFAULT_CUSTOM_DESC = 'Nhà cung cấp tùy chỉnh người dùng.';
const DEFAULT_CUSTOM_DESC_T = {
  en: 'User-defined custom provider.',
  zh: '用户自定义的提供商。',
  fr: 'Fournisseur personnalisé défini par l’utilisateur.'
};

function translate(id, dict, lang, original) {
  if (lang === 'vi') return original;
  const entry = dict[id];
  if (entry && entry[lang]) return entry[lang];
  return null;
}

/** Returns a copy of the provider with description/keyHelp localized to `lang`. */
function localizeProvider(p, lang) {
  const l = resolveLang(lang);
  if (l === 'vi') return p;
  const out = { ...p };
  const d = translate(p.id, DESCRIPTIONS, l, p.description);
  if (d) out.description = d;
  else if (p.description) {
    const m = AUTO_CONNECT.exec(p.description);
    if (m) out.description = AUTO_CONNECT_T[l](m[1]);
  }
  const k = translate(p.id, KEY_HELP, l, p.keyHelp);
  if (k) out.keyHelp = k;
  // Custom providers carry the Vietnamese default description when the user
  // left it blank — swap it for the active language.
  if (out.description === DEFAULT_CUSTOM_DESC) out.description = DEFAULT_CUSTOM_DESC_T[l];
  return out;
}

/** Returns a copy of the add-on manifest with its description localized to `lang`. */
function localizeAddon(a, lang) {
  const l = resolveLang(lang);
  if (l === 'vi') return a;
  const d = translate(a.id, ADDON_DESCRIPTIONS, l, a.description);
  return d ? { ...a, description: d } : a;
}

module.exports = { resolveLang, localizeProvider, localizeAddon };
