# OpenAI Studio · 多模型工作台

中文、独立部署的 OpenAI API 工作台。连接设置中填写一次 API Key，各栏目共用服务端加密会话。官方资料核对日期：2026-10-29。

## 本地使用

需要 Node.js 22.13 或更新版本。此目录已经安装依赖。

1. 双击「启动工作台.cmd」，或在此目录运行以下命令。
2. 打开 http://127.0.0.1:5173/#settings。
3. 填写自己的 OpenAI API Key，点击「保存并测试连接」。
4. 保存时只查询 /models；随后在各栏目选择模型、输入内容并主动发起请求。

~~~
npm ci
npm run setup:local
npm run dev
~~~

setup:local 只生成本机的 SESSION_SECRET；API Key 通过界面输入。关闭终端会停止本地服务器。端口占用时，使用启动日志中实际显示的 URL。

## 已实现的栏目

| 栏目 | 可用操作 |
| --- | --- |
| 对话与推理 | Responses、Chat Completions 与旧版 Completions；多轮对话、图片/PDF、流式输出、停止、推理强度、系统指令、JSON Schema、高级参数 |
| 内置工具 | 依据模型官方工具表显示联网搜索、代码解释器、图像生成、知识库检索；完整工具结果可查看和下载 |
| 图像创作 | 文生图、参考图编辑、蒙版、多图、尺寸、质量、透明背景、PNG/JPEG/WebP 与下载 |
| 语音合成 | 声音、语速、表达指令、输出格式、试听与下载 |
| 语音转写 | 音频文件上传、语言提示、上下文、Whisper 英译、兼容模型的字幕和说话人格式 |
| 音频对话 | Chat Completions 音频输入/输出，WAV/MP3 输入，文字和语音回复 |
| 实时语音 | Realtime WebRTC、GPT-Live 与 Responses 委托、实时翻译、通过 WebSocket 的实时转写、自定义协议事件 |
| 向量与语义 | 单条/批量文本、维度参数、余弦相似度矩阵与完整向量下载 |
| 内容审核 | 文本/图像审核、风险标记、分类评分和原始响应 |
| 视频生成 | 显示 Sora 和 Videos API 的官方停用信息；特殊权限账号可尝试历史任务查询 |
| 文件与知识库 | 文件上传与内容下载；创建/查询向量库、添加文件、检查索引与检索 |
| 批处理与训练 | JSONL 示例下载、批处理创建/查询/取消、微调任务和评估兼容接口 |
| 模型目录 | 官方目录 103 个条目与文档中公开的快照；用途、状态、能力、工具、上下文、官方来源与账号同步 |
| API 实验室 | 240 个官方路径索引、HTTP 方法、JSON/多文件表单/原始文本、常用模板、二进制响应下载 |
| 调用记录 | 本地最近 200 次请求的状态、耗时、Request ID 和返回用量；导出 JSON |

模型清单来自官方模型目录及每个模型的详情页，保留来源。原始参考资料位于 docs/reference，提取后的能力表位于 lib/generated/models.json。

## 能力边界

- 官方目录中同时包含正常、受限、待停用和已停用模型。界面保留历史条目，并标明停用时间；已停用模型无法恢复调用。
- /models 返回某个 ID 不保证每一种调用方式都有权限，生成仍受 API Key 权限、地区、余额、限流和服务状态影响。
- 目录外的账号模型保留在模型列表中；能力未知时通过 API 实验室指定接口。微调模型和已知快照继承基础模型能力，仍以 API 实际响应为准。
- 自定义函数、computer use、shell、apply_patch、Skills 或 MCP 的外部执行环境由应用所有者提供。实验室能够配置工具、显示请求与提交工具结果；工作台不会自动在用户电脑上执行模型返回的命令。
- API 实验室是通用 HTTP 调试入口；240 个路径索引不等于为每个组织管理、Agent 或 SDK 功能提供专门的向导。WebSocket 可用于实时转写；Responses WebSocket、SIP 与外部 Agent 环境不包含专用界面。
- Sora 2 和 Videos API 已于 2026-09-24 关闭。Speech API 现有 TTS 模型计划于 2027-01-06 关闭，旧转写模型计划于 2027-02-26 关闭。
- 微调新组织准入已受限，获准的活跃老客户在 2027-01-06 起无法创建新微调任务。Evals 计划于 2026-10-31 只读、2026-11-30 关闭。
- 没有 API Key 时可查看所有界面，但不能生成真实结果。协议测试使用本地替身，不产生 OpenAI 费用；真实模型输出、媒体播放和麦克风连接仍需填写有效 Key 后验证。
- 部分区域、网络、浏览器或模型访问限制可能影响实时连接。转写音频在本地 AudioWorklet 中编码为 24 kHz PCM；按「提交当前语音段」确认一段转写。GPT-Live 结束时等待 session.closed 获取最终用量。
- 输出图片、声音或视频只有来自真实接口响应时才显示。生成请求不自动重试；停止请求无法保证撤销上游已发生的计费。

## 配置和隐私

- SESSION_SECRET：32 字节随机值，保存在忽略追踪的 .dev.vars。生产环境通过 Sites 的加密运行时 Secret 设置。
- API Key 经服务端 AES-GCM 加密后放入 HttpOnly、SameSite=Strict Cookie；HTTPS 下附加 Secure。密文绑定当前站点来源与登录用户。
- 勾选「记住」为 30 天；否则为浏览器会话 Cookie，且解密后有效期最长 24 小时。
- 对话（包括附件）只保存在当前浏览器 IndexedDB；调用元数据保存在 localStorage。两者都可通过界面删除或导出。
- 请求经工作台服务端转发至官方 OpenAI API。后台密钥仅允许 api.openai.com、us.api.openai.com 或 eu.api.openai.com，不允许任意代理 URL 或跳转。
- 请求不记录密钥、不自动上传本地对话；Cookie 和真实请求参数不会写入源码。
- 保持部署为私有访问。Sites 登录由平台提供；没有自行搭建 OAuth 流程。

## 检查与生产构建

~~~
npm run typecheck
npm test
npm run build
~~~

测试覆盖会话加密和身份绑定、地址校验、跨站限制、multipart、二进制/SSE、限流错误、参数构造、模型/快照和输出解析。

开发服务器使用受保留的 Sites/Vinext 集成；worker/index.ts 的 /api/studio 路由处理会话与转发。wrangler.types.jsonc 仅用于生成绑定类型：

~~~
npx wrangler types worker-configuration.d.ts --config wrangler.types.jsonc --include-runtime false
~~~

## 官方资料

- [模型目录](https://developers.openai.com/api/docs/models)
- [API Reference](https://developers.openai.com/api/reference/overview)
- [停用时间表](https://developers.openai.com/api/docs/deprecations)
- [Responses 与文本](https://developers.openai.com/api/docs/guides/text)
- [图像生成](https://developers.openai.com/api/docs/guides/image-generation)
- [实时语音](https://developers.openai.com/api/docs/guides/realtime)
- [GPT-Live](https://developers.openai.com/api/docs/guides/live)
- [实时转写](https://developers.openai.com/api/docs/guides/realtime-transcription)

