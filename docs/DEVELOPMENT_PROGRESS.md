# NewEmby 开发进度表

> 当前版本：v1.2  
> 创建日期：2026-07-16  
> 最近更新：2026-07-17
> 当前阶段：M1 媒体浏览 MVP（完成，M2 待开始）
> 依据：[项目规划](PROJECT_PLAN.md) · [界面规范](UX_SPEC.md)

## 1. 使用方法

本文档是项目开发与验收的唯一进度入口。每次开始或完成任务时，同时
更新任务复选框、阶段摘要和文末日志。

状态约定：

- `[ ]` 未开始。
- `[x]` 已完成且满足“完成定义”。
- `进行中` 正在开发，同一时间建议不超过 3 项。
- `阻塞` 因依赖、权限或待确认决策无法继续。
- `延期` 已确认不进入当前版本。

更新规则：

1. 只有代码、测试和必要文档都完成后才能勾选开发任务。
2. 阶段内所有 P0 任务完成后，阶段才可以标记完成。
3. 任务发生范围变化时保留原任务，在“决策与变更日志”中记录原因。
4. 每次提交只处理一个任务或一组紧密相关任务，并在提交信息中包含任务 ID。
5. 未经测试服务器验证的 Emby 写操作不能标记完成。

## 2. 当前状态总览

| 阶段 | 目标 | 状态 | 已完成/总任务 | 进入条件 |
|---|---|---:|---:|---|
| D0 | 开发决策确认 | 完成 | 6/6 | 无 |
| M0 | 基础设施与设计系统 | 进行中 | 18/19 | D0 完成 |
| M1 | 媒体浏览 MVP | 完成 | 28/28 | 带 M0 外部阻塞进入 |
| M2 | PotPlayer 本地播放闭环 | 未开始 | 0/26 | M1 登录与详情稳定 |
| M3 | 前台体验完善 | 未开始 | 0/20 | M2 播放闭环通过 |
| M4 | 管理后台基础 | 未开始 | 0/20 | M1 API 适配层稳定 |
| M5 | 媒体与运维管理 | 未开始 | 0/25 | M4 权限与审计完成 |
| M6 | 完整设置与扩展 | 未开始 | 0/18 | M5 发布门通过 |

已完成的前期成果：

- [x] `DOC-001` 项目产品与技术规划文档。
- [x] `DOC-002` 界面视觉规范及首批 8 张高保真方向稿。

## 3. 关键路径

```text
D0 决策确认
  ↓
M0 工程骨架、契约、设计系统
  ↓
M1 登录、媒体浏览、详情
  ↓
M2 Bridge、PotPlayer、SMTC、进度回传
  ↓
M3 前台发布候选

M1 API 适配层稳定
  ↓
M4 管理概览、会话、用户、审计
  ↓
M5 媒体库、元数据、任务、日志
  ↓
M6 完整管理与扩展
```

M4 可以在 M2 后半段开始，但不能早于 M1 的认证、权限和 Emby API
适配层稳定。M2 是首个正式发布版本的核心路径，不能用“仅成功唤起
播放器”代替完整的进度回传验收。

## 4. D0：开发决策确认

阶段目标：消除会影响代码结构和发布方式的未决问题。

- [x] `D0-001` 确认 Player Bridge 首发操作系统。
  - 结论：Windows 首发，macOS、Linux 后续。
  - 最低 Windows 版本在 M2 SMTC 技术验证后锁定。
- [x] `D0-002` 确认首版完整支持的本地播放器。
  - 结论：PotPlayer 为第一适配器，mpv 为第二适配器。
  - PotPlayer 最低版本在 M2 SMTC 技术验证后锁定。
- [x] `D0-003` 确认部署拓扑。
  - 需要确定 Web、Gateway、Emby 是否同机，以及内外网访问地址。
  - 完成定义：补充一张最终部署图和环境变量清单。
- [x] `D0-004` 确认首版是否支持公网访问。
  - 结论：首版支持公网访问，且只允许通过 HTTPS 反向代理访问。
  - 可信来源使用完整 Origin 精确匹配，生产环境不开放通配 CORS。
- [x] `D0-005` 确认首版是否支持多个 Emby Server。
  - 结论：数据模型和缓存键预留 `serverId`，首版界面、登录和会话
    只支持一个当前服务器，多服务器切换延期到 M6。
- [x] `D0-006` 确认项目正式名称和品牌资源。
  - 结论：使用 NewEmby、`NewEmby.PlayerBridge`、`newemby://`、
    `#7C5CFF` 和仓库自有 SVG Logo。

### D0 发布门

- [x] 所有 D0 任务已经完成。
- [x] 结论已同步到 `PROJECT_PLAN.md`。
- [x] 没有会改变 Monorepo、认证或 Bridge 协议的待确认事项。

## 5. M0：基础设施与设计系统

阶段目标：建立可持续开发的项目骨架、共享契约和可验证 UI 基础。

### 5.1 仓库与工具链

- [x] `M0-001` 初始化 pnpm workspace Monorepo。
  - 目录包含 `apps/web`、`apps/gateway`、`apps/player-bridge`、
    `packages/contracts`、`packages/emby-client`、`packages/ui`。
  - 完成定义：根目录可执行统一安装、构建、检查和测试命令。
- [x] `M0-002` 配置 TypeScript、ESLint、Prettier 和 EditorConfig。
  - 完成定义：Web、Gateway 和 packages 使用共享配置且检查通过。
- [x] `M0-003` 配置环境变量模板及运行模式。
  - 完成定义：提交 `.env.example`，敏感值不进入仓库。
- [ ] `M0-004` 建立 CI。
  - 完成定义：每次提交执行 lint、typecheck、unit test 和 build。
- [x] `M0-005` 建立提交和版本约定。
  - 完成定义：README 记录分支、任务 ID、提交信息和版本策略。

### 5.2 共享契约与 Gateway 基础

- [x] `M0-006` 建立 OpenAPI/Schema 契约源。
  - 完成定义：Web 与 Bridge 客户端类型可由契约生成或共享。
- [x] `M0-007` 初始化 Fastify Gateway。
  - 完成定义：具备健康检查、请求 ID、结构化日志和统一错误格式。
- [x] `M0-008` 建立 SQLite 迁移框架。
  - 完成定义：可创建、升级、回滚测试数据库。
- [x] `M0-009` 实现服务器公共信息和 Ping 探测。
  - 完成定义：区分不可达、TLS 错误、超时和版本不兼容。
- [x] `M0-010` 建立 Emby DTO fixture 与脱敏规则。
  - 完成定义：测试 fixture 不包含真实 Token、用户、IP 或媒体路径。

### 5.3 Web 与设计系统

- [x] `M0-011` 初始化 React、Vite、Router 和 Query。
  - 完成定义：开发环境可打开应用壳并通过构建。
- [x] `M0-012` 实现设计令牌。
  - 完成定义：颜色、字体、间距、圆角、阴影和断点与 UX 规范一致。
- [x] `M0-013` 实现前台 `AppShell`、侧栏和顶栏。
- [x] `M0-014` 实现管理后台 `AdminShell`。
- [x] `M0-015` 实现基础组件。
  - 至少包含 Button、Input、Select、Dialog、Drawer、Toast、Skeleton、
    EmptyState、ErrorState 和 ConfirmDangerDialog。
- [x] `M0-016` 实现媒体基础组件。
  - 至少包含 PosterCard、ContinueWatchingCard、MediaRow 和 ImageFallback。
- [x] `M0-017` 建立组件预览和视觉回归基线。
  - 完成定义：核心组件具备正常、加载、空、错误和禁用状态。

### 5.4 已完成的设计输入

- [x] `M0-018` 完成项目与架构规划文档。
- [x] `M0-019` 完成视觉规范及首批页面方向稿。

设计参考映射：

| 页面 | 设计稿 |
|---|---|
| 首页 | [查看](../images/exec-5c27a38e-befb-45ec-86d4-b26f1ec73d7d.png) |
| 电影库 | [查看](../images/exec-cb8a6131-65cf-4ab6-91bd-aedaaa6c3c2a.png) |
| 电影详情 | [查看](../images/exec-0624575e-1f48-4d83-868e-bcb42223621c.png) |
| 剧集详情 | [查看](../images/exec-4e6be38a-6660-47c3-92d6-3afa07937bd4.png) |
| 本地播放准备 | [查看](../images/exec-44d5b3f7-0172-4d81-9b75-2cf45a116c55.png) |
| 管理概览 | [查看](../images/exec-af80b4eb-b622-40e0-b021-d0aa6e5d2938.png) |
| 用户管理 | [查看](../images/exec-506e3906-b7a5-44c4-899f-a84c06514699.png) |
| 媒体库管理 | [查看](../images/exec-e89ae098-3233-4fec-8226-e5caf229d569.png) |

### M0 发布门

- [x] 全新环境可依据 README 启动 Web 和 Gateway。
- [ ] CI 全部通过。
- [x] 核心设计组件通过键盘和基础对比度检查。
- [x] 公共服务器探测已在目标 Emby 版本验证。

## 6. M1：媒体浏览 MVP

阶段目标：不依赖 Emby 原始 Web 页面完成登录、媒体发现和详情浏览。

### 6.1 认证与会话

- [x] `M1-001` 实现服务器连接页面 `/connect`。
- [x] `M1-002` 实现公共用户读取与登录页面 `/login`。
- [x] `M1-003` Gateway 实现用户名密码认证代理。
- [x] `M1-004` 使用 HttpOnly Cookie 建立 NewEmby 会话。
- [x] `M1-005` 加密保存 Emby AccessToken。
- [x] `M1-006` 实现当前用户、权限和管理员能力探测。
- [x] `M1-007` 实现退出、Token 撤销和 401 统一恢复流程。

### 6.2 Emby 领域适配

- [x] `M1-008` 实现 UserProfile 和 ServerSummary 适配。
- [x] `M1-009` 实现 MediaLibrary、MediaCard 和 MediaDetail 适配。
- [x] `M1-010` 实现 SeasonSummary、EpisodeSummary 和 PersonSummary 适配。
- [x] `M1-011` 实现图片 URL 构造、Image Tag 和尺寸策略。
- [x] `M1-012` 实现能力探测和 Emby 版本记录。

### 6.2.1 M1-013 前审计收口（独立计数：4/4）

以下任务不计入 M1 原有 28 项，全部完成后才开始 `M1-013`。

- [x] `QA-001` 生产配置、工具链与数据库安全。
- [x] `QA-002` CSRF、会话切换与权限守卫。
- [x] `QA-003` 领域适配、延迟语义与真实 Emby Smoke。
- [x] `QA-004` 前端状态、可访问性与回归测试。

### 6.3 页面

- [x] `M1-013` 首页 `/home`。
  - 包含继续观看、我的媒体库、最近电影、最近剧集、收藏和类型横向轨道。
- [x] `M1-014` 电影库 `/movies`。
- [x] `M1-015` 剧集库 `/series`。
- [x] `M1-016` 通用媒体库 `/library/:libraryId`。
- [x] `M1-017` 用户级搜索 API 与顶栏 `SearchDropdown`（`/search` 兼容重定向）。
- [x] `M1-018` 电影详情 `/item/:id`。
- [x] `M1-019` 剧集详情、季选择和单集列表。
- [x] `M1-020` 统一加载、空状态、错误和无权限状态。

### 6.3.1 前端视觉基线迁移（独立计数：6/6）

以下返修不计入 M1 原有 28 项。所有页面统一以
`C:\Users\ifwwww\Desktop\常用脚本\emby-win` 的对应源码为表现层基线，
同时保留 NewEmby 品牌色、React 技术栈、Gateway 安全边界和可访问性要求。

- [x] `UX-001` 首页横向轨道、媒体库、卡片、拖拽和动效迁移。
- [x] `UX-002` 前台应用外壳、紧凑导航、顶栏和用户菜单迁移。
- [x] `UX-003` 服务器连接页与登录页迁移。
- [x] `UX-004` 电影、剧集和通用媒体库页面迁移。
- [x] `UX-005` 顶栏搜索、电影详情和剧集详情迁移。
- [x] `UX-006` 共享组件、状态页面、管理入口和全量视觉回归收口。

### 6.4 用户操作

- [x] `M1-021` 收藏与取消收藏。
- [x] `M1-022` 标记已看与未看。
- [x] `M1-023` 媒体库筛选、排序和 URL 状态。
- [x] `M1-024` 返回页面时恢复筛选、分页和滚动位置。

### 6.5 测试与性能

- [x] `M1-025` 领域适配与 Ticks 转换单元测试。
- [x] `M1-026` 登录、首页、筛选、详情和收藏 E2E。
- [x] `M1-027` 图片懒加载、预加载预算和虚拟网格。
- [x] `M1-028` Chrome、Edge、Firefox 桌面兼容验证。

### M1 发布门

- [x] 普通用户只能看见被授权媒体库。
- [x] 401、403、服务器离线和空媒体库均有正确界面。
- [x] 收藏和观看状态刷新页面后仍与 Emby 一致。
- [x] 首页可交互时间达到 `PROJECT_PLAN.md` 成功指标。
- [x] 不存在浏览器可读取的 Emby Token。

## 7. M2：PotPlayer 本地播放闭环

阶段目标：可靠启动 PotPlayer，通过 Windows SMTC 读取真实播放器状态并
同步回 Emby。

### 7.1 Bridge 骨架

- [ ] `M2-001` 初始化 C# / .NET 8 Player Bridge 工程。
  - 使用 self-contained single-file 发布，并预留 `IPlayerAdapter`。
- [ ] `M2-002` 实现回环 HTTP 服务，仅监听 localhost。
- [ ] `M2-003` 实现 `/v1/status` 和版本兼容响应。
- [ ] `M2-004` 注册 `newemby://` 自定义协议。
- [ ] `M2-005` 实现系统托盘、启动和退出。
- [ ] `M2-006` 实现 Windows 安装与卸载流程。

### 7.2 配对与安全

- [ ] `M2-007` Gateway 生成 60 秒配对码。
- [ ] `M2-008` Bridge 换取并安全保存设备凭证。
- [ ] `M2-009` 实现 Origin 白名单、nonce 和重放保护。
- [ ] `M2-010` 实现 Bridge 设备列表、解除配对和凭证撤销。

### 7.3 PlayTicket 与 PotPlayer

- [ ] `M2-011` 实现一次性 PlayTicket 数据模型。
- [ ] `M2-012` 实现票据签发、设备绑定、过期和一次兑换。
- [ ] `M2-013` Bridge 自动发现 PotPlayer 并读取版本。
- [ ] `M2-014` 实现 PotPlayer 安全启动参数。
  - 支持 `/new`、`/seek`、`/title`、`/sub`；参数中禁止出现 Emby Token。
- [ ] `M2-015` 实现 Windows SMTC 能力检查和会话事件订阅。
  - 检测 PotPlayer 是否启用“Use system media transport control”。
- [ ] `M2-016` 匹配 NewEmby 启动的 PotPlayer 会话。
  - 综合进程生命周期、`/title` 会话标识和媒体属性，处理多实例。
- [ ] `M2-017` 读取时长、位置、更新时间、暂停、跳转和结束状态。

### 7.4 播放回传

- [ ] `M2-018` 实现 Playing 回传。
- [ ] `M2-019` 实现 10 秒 Progress 心跳。
- [ ] `M2-020` 暂停、恢复、拖动和轨道变化即时回传。
- [ ] `M2-021` 正常结束、主动退出和异常退出发送 Stopped。
- [ ] `M2-022` 实现事件序号、幂等和临时断网队列。

### 7.5 Web 交互与测试

- [ ] `M2-023` 实现 Bridge 检测、安装提示和配对界面。
- [ ] `M2-024` 实现本地播放准备弹层。
- [ ] `M2-025` 实现当前播放浮层和真实状态更新。
- [ ] `M2-026` 完成暂停、拖动、结束、崩溃和断网 E2E。
  - 覆盖 SMTC 关闭、时间线停止更新、多实例和会话匹配失败。

### M2 发布门

- [ ] 播放器命令行和浏览器中都不存在 Emby AccessToken。
- [ ] 未配对网页不能调用 Bridge 启动播放器。
- [ ] SMTC 不可用时不能进入“完整进度同步”状态。
- [ ] PotPlayer 多实例时不会把进度写入错误媒体。
- [ ] 正常退出后的 Emby 播放进度误差不超过 15 秒。
- [ ] 重复或乱序事件不会破坏播放进度。
- [ ] Bridge、PotPlayer、SMTC、Gateway 任一不可用时均有明确恢复说明。

## 8. M3：前台体验完善

阶段目标：形成可日常使用的前台正式版本。

- [ ] `M3-001` 人物详情页。
- [ ] `M3-002` 收藏聚合页。
- [ ] `M3-003` 播放列表列表、详情、创建、排序和删除。
- [ ] `M3-004` 多媒体版本选择。
- [ ] `M3-005` 音轨和字幕语言偏好。
- [ ] `M3-006` Bridge 连续播放和下一集队列。
- [ ] `M3-007` 用户设置页。
- [ ] `M3-008` 默认播放器和默认播放行为设置。
- [ ] `M3-009` 主题、界面密度和海报尺寸设置。
- [ ] `M3-010` 手机端导航和首页适配。
- [ ] `M3-011` 手机端媒体库和详情适配。
- [ ] `M3-012` 键盘全流程和焦点管理。
- [ ] `M3-013` `prefers-reduced-motion` 支持。
- [ ] `M3-014` 文本对比度和屏幕阅读器检查。
- [ ] `M3-015` 全局命令搜索和键盘快捷键。
- [ ] `M3-016` 网络恢复、重试和离线状态提示。
- [ ] `M3-017` 前端错误监控与隐私脱敏。
- [ ] `M3-018` Web 性能预算和回归测试。
- [ ] `M3-019` Bridge 自动更新和签名校验设计。
- [ ] `M3-020` 用户文档、安装指南和故障排查。

### M3 发布门

- [ ] 桌面端前台满足日常浏览和本地播放需求。
- [ ] 手机端可以完成浏览、搜索和发起远程本地播放请求。
- [ ] 核心路径可以只使用键盘完成。
- [ ] 安装、升级和故障恢复文档已通过一次全新环境验证。

## 9. M4：管理后台基础

阶段目标：完成管理员常用监控、会话和用户管理能力。

- [ ] `M4-001` 管理路由守卫和 Gateway 管理员校验。
- [ ] `M4-002` 管理后台权限矩阵。
- [ ] `M4-003` 管理操作审计表和查询接口。
- [ ] `M4-004` 管理概览页面框架。
- [ ] `M4-005` 服务器版本、运行时间和健康信息。
- [ ] `M4-006` CPU、内存和磁盘能力探测。
  - 无对应 Emby API 时明确标记 Gateway/宿主扩展来源。
- [ ] `M4-007` 媒体项目数量摘要。
- [ ] `M4-008` 当前任务进度摘要。
- [ ] `M4-009` 最近活动时间线。
- [ ] `M4-010` 活动会话列表。
- [ ] `M4-011` 会话消息和允许的远程控制。
- [ ] `M4-012` Bridge 会话和 Emby 原生会话标识。
- [ ] `M4-013` 用户列表、搜索和状态。
- [ ] `M4-014` 新建用户。
- [ ] `M4-015` 用户媒体库权限编辑。
- [ ] `M4-016` 用户播放、远程访问和设备策略编辑。
- [ ] `M4-017` 密码重置。
- [ ] `M4-018` 禁用和删除用户二次确认。
- [ ] `M4-019` 普通用户越权测试。
- [ ] `M4-020` 管理概览、会话和用户 E2E。

### M4 发布门

- [ ] 所有管理员接口均在 Gateway 再次校验权限。
- [ ] 权限变更、禁用和删除操作都有审计记录。
- [ ] 普通用户无法通过直接请求调用管理 API。
- [ ] 会话列表与 Emby 后台结果一致。

## 10. M5：媒体与运维管理

阶段目标：覆盖媒体库、元数据、任务、设备和日志等日常运维功能。

### 10.1 媒体库

- [ ] `M5-001` 虚拟媒体库列表和详情。
- [ ] `M5-002` 新增、重命名和删除媒体库。
- [ ] `M5-003` 添加、更新和删除媒体路径。
- [ ] `M5-004` 内容类型、语言、国家和抓取选项。
- [ ] `M5-005` 启动扫描并显示任务进度。
- [ ] `M5-006` 删除前影响提示和输入确认。

### 10.2 元数据与图片

- [ ] `M5-007` 单项元数据编辑表单。
- [ ] `M5-008` Provider IDs 编辑和校验。
- [ ] `M5-009` 图片列表、选择、上传和删除。
- [ ] `M5-010` 元数据刷新及替换范围选择。
- [ ] `M5-011` 所有元数据写操作审计。

### 10.3 任务、设备和 Key

- [ ] `M5-012` 计划任务列表和详情。
- [ ] `M5-013` 启动和停止任务。
- [ ] `M5-014` 任务触发器编辑。
- [ ] `M5-015` 设备列表和删除设备。
- [ ] `M5-016` API Key 创建、备注和撤销。
- [ ] `M5-017` API Key 只在创建后完整显示一次。

### 10.4 日志与活动

- [ ] `M5-018` 活动日志时间线和分页。
- [ ] `M5-019` 日志文件列表。
- [ ] `M5-020` 日志级别筛选、搜索和上下文。
- [ ] `M5-021` 日志下载。
- [ ] `M5-022` Token、密码、路径和敏感字段脱敏。

### 10.5 测试

- [ ] `M5-023` 独立测试媒体库的写操作契约测试。
- [ ] `M5-024` 删除、刷新、扫描和任务停止的异常恢复测试。
- [ ] `M5-025` 媒体库、元数据、任务、设备和日志 E2E。

### M5 发布门

- [ ] 所有删除操作均具有影响提示和二次确认。
- [ ] Gateway 未识别字段不会在更新时被清空。
- [ ] 管理写操作已在独立测试服务器验证。
- [ ] 日志界面和下载内容不会泄露 Token 或密码。

## 11. M6：完整设置与扩展

阶段目标：覆盖高级服务器配置，并为跨平台和新媒体类型预留扩展。

- [ ] `M6-001` 服务器通用设置。
- [ ] `M6-002` 网络和远程访问设置。
- [ ] `M6-003` 字幕和转码设置。
- [ ] `M6-004` 数据库和高级设置。
- [ ] `M6-005` 设置保存前差异预览。
- [ ] `M6-006` 未识别配置字段原样保留。
- [ ] `M6-007` 重启与关机高风险确认流程。
- [ ] `M6-008` 已安装插件列表和详情。
- [ ] `M6-009` 插件受控 JSON 配置表单。
- [ ] `M6-010` 插件安装、更新、禁用和卸载。
- [ ] `M6-011` mpv JSON IPC 第二播放器适配器。
- [ ] `M6-012` macOS Bridge 适配。
- [ ] `M6-013` Linux Bridge 适配。
- [ ] `M6-014` 多服务器支持。
- [ ] `M6-015` Live TV 产品和技术评估。
- [ ] `M6-016` 音乐客户端产品和技术评估。
- [ ] `M6-017` 电视端遥控焦点系统评估。
- [ ] `M6-018` VLC 播放器适配评估与实现。

### M6 发布门

- [ ] 高风险系统操作具有权限、确认和审计三重保护。
- [ ] 设置更新不会丢失未知 Emby 配置字段。
- [ ] 新平台 Bridge 通过对应系统的安装、升级和播放测试。
- [ ] 扩展功能分别拥有独立范围和验收文档。

## 12. 全局质量清单

以下项目贯穿所有阶段，不应等到发布前集中处理。

### 安全

- [ ] Emby Token 不出现在前端存储、URL、日志或播放器参数中。
- [ ] Cookie 使用 HttpOnly、Secure 和合适的 SameSite 策略。
- [ ] 管理接口防 CSRF、重放和越权。
- [ ] Bridge 只监听回环地址并校验来源。
- [ ] 依赖和安装包有持续漏洞检查。

### 可访问性

- [ ] 文字和背景对比度达标。
- [ ] 所有图标按钮具有可访问名称。
- [ ] 弹层焦点进入、约束和恢复正确。
- [ ] 错误、在线、已看等状态不只依赖颜色。
- [ ] 动效尊重减少动态效果设置。

### 性能

- [ ] 图片按容器和 DPR 请求合适尺寸。
- [ ] 长媒体列表使用虚拟化或可靠分页。
- [ ] 页面切换不重复请求稳定数据。
- [ ] 首页与详情建立明确预加载预算。
- [ ] CI 记录 bundle 和核心页面性能变化。

### 可观测性

- [ ] Web、Gateway、Bridge 使用统一 Request/Session ID。
- [ ] 错误日志包含操作上下文但不包含敏感数据。
- [ ] 播放事件能够追踪到具体 PlaySessionId。
- [ ] 管理写操作具有结果、操作者和目标记录。

## 13. 当前进行中、阻塞与下一步

### 进行中

- 无。M1 已完成，M2 尚未开始。

### 阻塞

- `M0-004` workflow 已建立并通过静态检查；仓库尚无 GitHub 远程和
  实际 Actions 运行记录，按完成定义暂不勾选。
- 本机未安装 Docker，Compose/Caddy 示例尚未实际构建和启动，相关 M0
  发布门保持未勾选。

### 建议下一步

1. 开始 `M2-001` Player Bridge 工程初始化。
2. 配置 GitHub 远程并让 Actions 首次全量通过，完成 `M0-004`。
3. 安装 Docker 后实际构建并启动 Compose/Caddy 示例。

## 14. 决策与变更日志

| 日期 | 类型 | 内容 | 影响阶段 | 记录人 |
|---|---|---|---|---|
| 2026-07-15 | 范围 | 不实现 Web 视频播放，使用本地播放器并回传进度 | M2 | 项目组 |
| 2026-07-15 | 范围 | 管理后台纳入路线图，安排在媒体浏览和播放闭环之后 | M4–M6 | 项目组 |
| 2026-07-16 | 设计 | 完成首批 8 张桌面端高保真方向稿 | M0 | 项目组 |
| 2026-07-16 | 技术决策 | Windows 首发，PotPlayer 为第一播放器适配器，通过 SMTC 回传状态；mpv 调整为第二适配器 | D0, M2, M6 | 项目组 |
| 2026-07-16 | 部署 | Web 与 Gateway 同源公网部署，通过 HTTPS 访问现有公网 Emby | D0, M0–M6 | 项目组 |
| 2026-07-16 | 范围 | 首版单 Emby Server，数据模型预留多服务器字段 | D0, M0, M6 | 项目组 |
| 2026-07-16 | 品牌 | 使用 NewEmby、`NewEmby.PlayerBridge`、`newemby://` 和自有 SVG | D0, M0, M2 | 项目组 |
| 2026-07-16 | 工具链 | Node 基线由 22.12 提升至 22.13，以满足冻结锁文件中 ESLint 依赖的最低引擎要求 | M0 | 项目组 |
| 2026-07-16 | 设计 | 后续所有前端及现有页面统一迁移到本机 `emby-win` 参考应用的布局、卡片和动效基线，保留 NewEmby 品牌与安全架构 | M0–M6 | 项目组 |
| 2026-07-17 | 设计 | 搜索不再使用独立页面，按参考应用 `SearchDropdown.vue` 迁移到顶栏展开输入框与玻璃结果浮层；`/search` 仅保留兼容重定向 | M1、UX-005 | 项目组 |

## 15. 开发记录

每次开发后在表格顶部追加一行，并同步对应任务复选框。

| 日期 | 任务 ID | 状态 | 结果与验证 | 提交/文件 | 下一步 |
|---|---|---|---|---|---|
| 2026-07-17 | M1-028 | 完成 | Playwright 已建立 Chromium、Chrome、Firefox 和本机 Edge 桌面兼容项目，覆盖首页布局、键盘跳转、媒体导航、顶栏搜索、Escape 关闭与焦点恢复、横向溢出及运行时控制台错误；修复搜索浮层关闭后焦点未回到触发按钮的问题。本机四浏览器 4/4 通过，CI 配置加入 Chromium 与 Firefox（远程 Actions 仍按 M0-004 保持阻塞）；全仓 167 项单测、25 项 Chromium E2E、2 项 Chromium/Firefox 兼容回归、Storybook、axe/视觉、lint/typecheck/build 均通过。生产构建首页可交互 660 ms，本地 Smoke、迁移 `up/down/up` 和差异检查通过。M1 五项发布门全部满足，阶段收口为 28/28 | Web、Playwright、CI、README、进度表 | M2-001 |
| 2026-07-17 | M1-027 | 完成 | 已引入 TanStack React Virtual 对电影、剧集和通用媒体库执行 window 行级虚拟化，仅保留可见行及相邻一行；100 项回归确认 DOM 不再一次性渲染全部卡片。媒体图片补齐固定宽高，普通图片原生懒加载并使用低优先级，首张媒体图与详情焦点图使用 eager/high；Image Tag 继续作为不可变代理缓存键。媒体路由使用不抛异常的预取，在虚拟网格测量前准备缓存，同时保持 401、403、离线状态和滚动恢复。生产构建在受控 10 Mbps/40 ms 网络下首个有效交互为 698 ms；真实 Emby 4.8.9.0 只读首页聚合 36 项耗时 1095 ms，图片与详情读取正常且会话已退出。全仓 167 项单测、lint/typecheck/build、生产性能门、24 项 E2E（另 1 项显式性能用例在普通套件跳过）、本地 Smoke、格式和差异检查通过，既有卡片视觉基线未改变 | Web、UI、TanStack Virtual、Playwright、Smoke | M1-028 |
| 2026-07-17 | M1-026 | 完成 | 已将可控模拟 API 的认证流程扩展为完整用户旅程，覆盖连接、登录、会话刷新、首页、电影筛选、详情、收藏乐观更新、刷新后服务端状态确认、恢复原收藏值及退出；原有 401、403、服务器离线、空媒体库、写入失败回滚、axe、键盘和截图场景继续纳入同一套件。修复滚动恢复用例的程序化滚动竞态，改为真实滚轮事件并在双 worker 下重复 3/3 通过；完整 Playwright 23/23、Web lint/typecheck/build、本地 Smoke、格式和差异检查通过，未访问或修改真实 Emby 数据 | Web、Playwright、模拟 API | M1-027 |
| 2026-07-17 | M1-025 | 完成 | 已扩展 Emby DTO 与领域适配回归：覆盖 Ticks 零值、秒边界和最大安全整数，拒绝负值及小数 Ticks；覆盖播放百分比上下界钳制、空值与纯空白字段清理、未知媒体/媒体库/人物类型安全回退、完整数组筛选与排序到 Emby 用户接口的编码，并在构建后验证公共包入口导出。Emby Client 57 项及全仓 164 项单测通过，包级 lint/typecheck/build、格式和差异检查通过 | Emby Client、Contracts、单元测试 | M1-026 |
| 2026-07-17 | M1-024 | 完成 | 已启用 TanStack Router 原生滚动恢复，并以路径和规范化查询串作为独立缓存键；电影、剧集和通用媒体库的页码、重复筛选参数、排序及滚动位置可随浏览器返回恢复，互不污染。Web 25 项单测及 lint/typecheck/build 通过，23 项认证/axe/键盘/筛选/截图 E2E、本地 Smoke、格式和差异检查通过，其中新增回归实际验证详情页返回后的 URL 与滚动位置 | Web、Router、Playwright | M1-025 |
| 2026-07-17 | M1-023 | 完成 | 已在电影、剧集和通用媒体库加入媒体库、媒体类型、类型标签、年份、分级、最低评分、观看、收藏、剧集状态、排序字段与顺序筛选；页码、排序和筛选均使用规范化可分享 URL，数组通过全局 Router 序列化器写为重复参数并由 Gateway 校验。筛选面板沿用参考应用紧凑玻璃视觉，空结果仍可调整或重置。Gateway 54 项、Web 24 项单测及 lint/typecheck/build 通过，22 项认证/axe/键盘/筛选/截图 E2E、本地 Smoke、格式和差异检查通过，四张筛选相关基线已人工核对 | Gateway、Web、Router、Playwright | M1-024 |
| 2026-07-17 | M1-022 | 完成 | 已实现幂等已看/未看写入、精确 Origin 与签名 CSRF 校验、统一上游错误映射，以及首页、列表、搜索和详情的乐观更新、续播行同步与失败回滚；详情按钮和卡片已看徽标沿用参考应用玻璃视觉。Emby Client 45 项、Gateway 54 项、Web 20 项单测及各包 lint/typecheck/build 通过，21 项认证/axe/键盘/截图 E2E 与本地 Smoke 通过；真实 Emby 可逆写 Smoke 已验证临时已看状态、恢复为未看且进度为零并退出会话，未记录敏感信息 | Emby Client、Gateway、Web、Playwright、Smoke | M1-023 |
| 2026-07-17 | M1-021 | 完成 | 已实现幂等收藏写入、精确 Origin 与签名 CSRF 校验、统一 `EMBY_WRITE_FAILED` 映射，以及首页、列表、搜索和详情缓存的一致乐观更新与失败回滚；浏览器仅收到最新用户状态，不接触 Emby Token。Contracts、Emby Client、Gateway、Web 的 lint/typecheck/build 及 121 项包级测试通过，19 项认证/axe/键盘/截图 E2E 和本地 Smoke 通过；真实 Emby 可逆写 Smoke 已验证临时收藏状态、恢复原状态并退出会话，未记录敏感信息 | Contracts、Emby Client、Gateway、Web、Playwright、Smoke | M1-022 |
| 2026-07-17 | M1-020 | 完成 | 已统一首页、电影、剧集、媒体库、详情、季和单集的错误呈现：403/`ACCESS_DENIED` 使用无重试的权限状态，404/`MEDIA_NOT_FOUND` 显示资源不存在，离线、超时、5xx 和反向代理非 JSON 错误保留重试及 Request ID，401 继续走全局登录恢复；固定比例骨架、空状态和参考应用玻璃视觉保持一致。Web lint/typecheck/build、15 项单测、本地 smoke 及 18 项认证/axe/键盘/截图回归通过，新增无权限视觉基线并人工核对 | Web、Playwright | M1-021 |
| 2026-07-17 | M1-019 | 完成 | 已实现当前用户级季与单集读取，Gateway 复用认证媒体上下文、上游错误映射和 401 会话撤销；剧集详情支持默认优先未看季、季选择、横向单集缩略图、简介、时长、播放进度和已看状态。Emby Client 43 项、Gateway 52 项单测、Web 类型检查及 16 项页面回归通过；真实 Emby 4.8.9.0 只读 smoke 成功读取 1 个季和 11 个单集，测试会话已退出且未记录敏感信息 | Emby Client、Gateway、Web、Smoke | M1-020 |
| 2026-07-17 | UX-006 | 完成 | 已将共享主题、按钮、输入、选择器、骨架、图片占位、媒体卡、媒体行、弹层、抽屉、通知及空/错误状态统一为参考应用的深蓝紫玻璃、渐变、阴影和缓动；管理入口迁移为紧凑玻璃侧栏、状态卡和禁用模块列表；新增管理、空状态和离线错误基线并人工核对。全仓 `verify:local` 通过：136 项单测、Storybook 构建、2 项组件 axe/视觉及 16 项认证/页面 axe/键盘/截图回归全部通过 | UI、Web、Storybook、Playwright | M1-019 |
| 2026-07-17 | UX-005 | 完成 | 已按参考应用 `SearchDropdown.vue` 将搜索迁入顶栏，提供 250ms 防抖、玻璃结果浮层、清除、Escape 和点击外部关闭，旧 `/search` 仅兼容重定向；电影/剧集详情已迁移为沉浸式背景、元数据与操作区、演职人员、相关推荐、季选择和横向单集卡；Web lint/typecheck/build、本地 smoke 及 13 项认证/axe/键盘/截图回归通过，并核对 3 张新增基线与更新后的应用外壳基线 | Web、Playwright、UX/项目文档 | UX-006 |
| 2026-07-16 | UX-004 | 完成 | 已将电影、剧集、授权媒体库和通用媒体库迁移为参考应用的渐变标题、计数胶囊、自适应海报网格、纵向玻璃库列表和紧凑分页；所有媒体卡统一复用首页的上浮、封面缩放、遮罩、评分/未看徽标、发光进度条与信息高亮，补充固定比例骨架；Web lint/typecheck/build 通过，9 项 axe/键盘/认证/动效/截图回归通过并人工核对 4 张新基线 | Web、Playwright | UX-005 |
| 2026-07-16 | UX-003 | 完成 | 已将连接页与登录页迁移为参考应用的动态光晕背景、居中玻璃卡、自有品牌标志、紧凑服务器状态、公共用户选择和表单层级；补齐服务器与用户选择的键盘焦点顺序，人工核对两张 Chromium 基线，Web lint/typecheck/build 及 5 项 axe/键盘/认证/视觉回归通过 | Web、Playwright | UX-004 |
| 2026-07-16 | UX-003 | 进行中 | 正在迁移动态光晕背景、居中玻璃卡、品牌标志、服务器状态、公共用户与登录表单 | Web | 完成连接/登录视觉与交互验证 |
| 2026-07-16 | UX-002 | 完成 | 已移除 64px 上下文顶栏和 72px 左侧栏，迁移为参考应用的 48px 玻璃顶栏、自有标志、渐变胶囊活动导航、紧凑搜索/Bridge 状态、圆形用户入口和玻璃下拉菜单；修复视觉验证曾读取陈旧 UI 构建产物的问题，重建共享包后人工核对新截图并稳定复跑 5 项 axe/键盘/认证/视觉回归，UI 22 项测试及 Web lint/typecheck/build 通过 | UI、Web、Playwright | UX-003 |
| 2026-07-16 | UX-002 | 进行中 | 正在将 64px 顶栏和左侧导航迁移为参考应用的紧凑玻璃顶栏、胶囊导航、搜索与用户菜单 | UI、Web | 完成外壳视觉与交互验证 |
| 2026-07-16 | UX-001 | 完成 | 已对照参考应用源码将首页重构为继续观看、我的媒体库、最新电影、最新剧集、收藏和类型横向轨道；实现 160/196px 卡片、左右翻页、平滑/拖拽滚动、5px 误点击保护、封面上浮与缩放、评分/未看徽标、遮罩和发光进度条，保留 `#7C5CFF` 品牌色；Web lint/typecheck/build、5 项 axe/键盘/截图/认证回归通过并更新 Chromium 基线 | Web、Playwright、UX/项目文档 | UX-002 |
| 2026-07-16 | M1-019 | 进行中 | 正在实现当前用户级剧集详情、季选择、单集缩略图、简介、时长、进度和未看状态 | Contracts、Emby Client、Gateway、Web | 完成剧集详情验证与提交 |
| 2026-07-16 | M1-018 | 完成 | 已实现当前用户级电影详情与相似条目查询，Gateway 仅返回稳定领域模型；`/item/:id` 展示背景、海报、Logo、元数据、简介、类型、演职人员、相关推荐和用户状态，首页、电影库、授权媒体库及搜索结果均已启用详情入口；全仓 134 项单测、lint、typecheck、build、5 项浏览器回归及本地 Smoke 通过 | Emby Client、Gateway、Web | M1-019 |
| 2026-07-16 | M1-018 | 进行中 | 正在实现电影详情、演职人员、相关推荐和图片构图 | Contracts、Emby Client、Gateway、Web | 完成电影详情验证与提交 |
| 2026-07-16 | M1-017 | 完成 | 已实现带当前 UserId 的电影、剧集、单集和人物并行搜索，Gateway 返回分组领域模型；`/search` 具备 250ms 防抖、URL 关键词、键盘输入、分组结果、最近搜索及加载/空/错误状态，全局搜索与侧栏入口启用；全仓 132 项单测、lint、typecheck、build、5 项浏览器回归及本地 Smoke 通过 | Emby Client、Gateway、Web | M1-018 |
| 2026-07-16 | M1-017 | 进行中 | 正在实现用户级电影、剧集、单集和人物分组搜索及本地最近搜索 | Emby Client、Gateway、Web | 完成搜索验证与提交 |
| 2026-07-16 | M1-016 | 完成 | 已新增授权媒体库选择页和 `/library/:libraryId` 通用网格，Gateway 在带 `libraryId` 的媒体查询前重新读取当前用户 Views 并拒绝越权 ID，混合库仅查询安全支持的电影、剧集和视频类型；全仓 131 项单测、lint、typecheck、build、5 项浏览器回归及本地 Smoke 通过 | Gateway、Web | M1-017 |
| 2026-07-16 | M1-016 | 进行中 | 正在以当前用户视图校验 `libraryId`，实现媒体库入口与通用海报网格 | Gateway、Web | 完成媒体库验证与提交 |
| 2026-07-16 | M1-015 | 完成 | 已扩展剧集连载/完结状态和最近媒体加入日期适配，`/series` 展示用户授权剧集、未看集数、最近更新、状态徽标和分页，导航及上下文标题同步启用；全仓 130 项单测、lint、typecheck、build、5 项浏览器回归及本地 Smoke 通过 | Contracts、Emby Client、Web | M1-016 |
| 2026-07-16 | M1-015 | 进行中 | 正在扩展剧集连载状态、最近更新和未看集数，并实现 `/series` | Contracts、Emby Client、Web | 完成剧集库验证与提交 |
| 2026-07-16 | M1-014 | 完成 | 已新增用户级媒体分页查询和 Gateway 鉴权路由，电影库按最近加入排序展示授权范围内的海报网格、总数和基础分页，电影导航与页面标题同步启用；全仓 129 项单测、lint、typecheck、build、5 项浏览器回归及本地 Smoke 通过 | Emby Client、Gateway、Web | M1-015 |
| 2026-07-16 | M1-014 | 进行中 | 正在实现用户级媒体分页查询、电影海报网格和基础分页 | Emby Client、Gateway、Web | 完成电影库验证与提交 |
| 2026-07-16 | M1-013 | 完成 | 已使用跨平台 Node 编排修复 Windows 根 `dev`，实测 Web 5173 与 Gateway 3000 同时监听；新增认证媒体首页/媒体库/图片代理契约与 Gateway 会话保护，首页包含焦点区、继续观看、最近电影、最近剧集、收藏和智能类型栏目，登录及根路由统一进入 `/home`；全仓 127 项单测、lint、typecheck、build、5 项浏览器 axe/键盘/视觉/认证回归及本地 Smoke 通过 | Contracts、Emby Client、Gateway、Web、Playwright | M1-014 |
| 2026-07-16 | M1-013 | 进行中 | 正在修复 Windows 根 `dev` 启动链路，建立认证媒体 API、图片代理和 `/home` 首页 | Contracts、Emby Client、Gateway、Web | 完成首页验证与提交 |
| 2026-07-16 | QA-004 | 完成 | 已修复缺图、字段关联、查询门控与当前服务器读取失败状态；用户菜单改为具备 Escape、焦点恢复和外部关闭的 Radix 菜单，未实现入口统一禁用，有效导航使用 TanStack Link，非 JSON 代理错误保留状态与 Request ID；全仓 122 项单测、构建、Storybook、2 项组件视觉/axe、5 项认证/守卫/页面 axe/键盘/截图 E2E、本地 smoke、迁移 `up/down/up`、冻结安装、生产审计（0 漏洞）和差异检查通过；真实 Emby 4.8.9.0 再次完成探测、登录、用户、16 个视图、授权媒体、图片和退出，未记录敏感信息 | UI、Web、Playwright/CI、进度表 | M1-013 |
| 2026-07-16 | QA-004 | 进行中 | 正在修复前端状态、表单可访问性、用户菜单、导航与 API 错误兼容，并扩展页面级回归 | UI、Web、Playwright/CI | 完成 QA-004 验证与提交 |
| 2026-07-16 | QA-003 | 完成 | 已从 `@newemby/emby-client` 公共入口导出 Server/User/Media/Season/Episode/Person DTO Schema 与适配器，延迟固定为独立 Ping 耗时，未知类型继续安全回退，真实 Smoke 的媒体查询显式限定类型；Emby Client 36 项、全仓 119 项单测、构建、Storybook、2 项视觉/axe、2 项认证 E2E、本地 smoke 与差异检查通过；真实 Emby 4.8.9.0 的公共探测、登录、当前用户、16 个视图、授权媒体、图片及退出全部通过且无敏感输出，目标 Emby 发布门已勾选 | `packages/emby-client`, `scripts/emby-smoke.mjs`, README/进度表 | QA-004 |
| 2026-07-16 | QA-003 | 进行中 | 正在补齐 Emby Client 公共领域导出、修正 Ping 延迟语义并建立真实 Emby Smoke | `packages/emby-client`, 根脚本、README/进度表 | 完成 QA-003 验证与提交 |
| 2026-07-16 | QA-002 | 完成 | 已新增签名双提交 CSRF，服务器选择/登录/退出同时校验精确 Origin；切换 Server ID 会先撤销旧会话并尽力上游退出，同服务器和探测失败不破坏会话；会话错配、损坏密文、过期/撤销数据与登录落库失败均安全收口，`/admin` 具备服务器/登录/管理员能力守卫；117 项单测、构建、Storybook、2 项视觉/axe、2 项认证与管理 E2E、本地 smoke 和差异检查通过 | Contracts、Gateway、Web | QA-003 |
| 2026-07-16 | QA-002 | 进行中 | 正在实现签名双提交 CSRF、服务器切换会话撤销、失效会话清理和管理路由能力守卫 | Contracts、Gateway、Web | 完成 QA-002 验证与提交 |
| 2026-07-16 | QA-001 | 完成 | 已锁定 pnpm 11.13.1 与过观察期依赖，生产模式拒绝开发/占位/无效密钥、HTTP Emby 和清单外 Origin，代理信任仅允许跳数或 IP/CIDR；Compose 固定生产模式，Gateway 镜像预授权 `/data`，实际迁移前一致性备份且仅保留 5 份；冻结安装、106 项单测、构建、Storybook、2 项视觉/axe、本地 smoke、生产依赖审计（0 漏洞）和差异检查通过，Docker 仅静态校验 | 根工具链、`apps/gateway`, Compose/CI/README | QA-002 |
| 2026-07-16 | QA-001 | 进行中 | 正在升级 pnpm 11.13.1、收紧生产环境密钥/Origin/代理信任校验，并实现迁移前 SQLite 备份与生产依赖审计 | 根工具链、`apps/gateway`, Compose/CI/README | 完成 QA-001 验证与提交 |
| 2026-07-16 | M1-012 | 完成 | 已扩展公共用户、用户认证、用户视图、用户媒体和图片处理能力标志，公共用户只读探测失败时安全闭合，并验证版本号与能力 JSON 持久化；Emby Client 34 项、Gateway 22 项及根级 format/check/build/smoke 全部通过 | `packages/contracts/src/server.ts`, `packages/emby-client/src/probe.ts`, `apps/gateway/src/database/migrator.test.ts` | M1-013 |
| 2026-07-16 | M1-012 | 进行中 | 正在扩展只读服务器能力探测，并验证版本号与能力标志随当前服务器持久化 | `packages/contracts`, `packages/emby-client`, `apps/gateway` | 完成能力与版本记录验证 |
| 2026-07-16 | M1-011 | 完成 | 已实现不携带 Token 的子路径安全图片 URL、必需 Image Tag 缓存键，以及海报 360–480px、背景 1920/2560px、横图、头像和 Logo 的 DPR 尺寸预算；Emby Client 33 项及根级 format/check/build/smoke 全部通过 | `packages/emby-client/src/image.ts` | M1-012 |
| 2026-07-16 | M1-011 | 进行中 | 正在实现不含 Token 的 Emby 图片 URL、不可变 Image Tag 查询参数和海报/横图/背景/头像尺寸预算 | `packages/emby-client` | 完成图片策略验证 |
| 2026-07-16 | M1-010 | 完成 | 已新增 `SeasonSummary`、`EpisodeSummary`、`PersonSummary` 契约及转换，覆盖季序号/未看数、单集编号/时长/进度、人物类型/角色/头像并保留 `serverId`；Emby Client 28 项及根级 format/check/build/smoke 全部通过 | `packages/contracts/src/media.ts`, `packages/emby-client/src/media-adapters.ts` | M1-011 |
| 2026-07-16 | M1-010 | 进行中 | 正在定义季、单集和人物领域契约，并复用 BaseItemDto 校验与时长/观看状态转换 | `packages/contracts`, `packages/emby-client` | 完成关联媒体适配验证 |
| 2026-07-16 | M1-009 | 完成 | 已新增 `MediaLibrary`、`MediaCard`、`MediaDetail` 共享契约及 BaseItemDto 纯适配器，稳定映射媒体类型、图片标签、用户观看状态、评分、年份、时长、简介与流派并隔离 Emby 原始字段；Emby Client 25 项及根级 format/check/build/smoke 全部通过 | `packages/contracts/src/media.ts`, `packages/emby-client/src/media-adapters.ts` | M1-010 |
| 2026-07-16 | M1-009 | 进行中 | 正在定义媒体库、媒体卡和媒体详情领域契约，并实现 BaseItemDto 到稳定模型的转换 | `packages/contracts`, `packages/emby-client` | 完成媒体领域适配验证 |
| 2026-07-16 | M1-008 | 完成 | 已抽取统一 Emby PublicInfo/User DTO Schema 与纯领域适配器，探测、登录和会话刷新共用 `ServerSummary`/`UserProfile` 转换；覆盖 URL、HTTPS、延迟取整、管理员/下载能力、空策略和原始字段隔离，Emby Client 21 项及根级 format/check/build/smoke 全部通过 | `packages/emby-client/src/domain-adapters.ts`, `probe.ts`, `authentication.ts`, `current-user.ts` | M1-009 |
| 2026-07-16 | M1-008 | 进行中 | 正在抽取可复用的 Emby Server/User DTO 校验与领域模型转换，统一探测、登录和会话刷新路径 | `packages/contracts`, `packages/emby-client` | 完成领域适配验证 |
| 2026-07-16 | M1-007 | 完成 | 已实现本地优先会话撤销、Emby `/Sessions/Logout` 尽力注销、上游 401/403 会话失效、精确 Origin 校验、前端用户菜单与统一未认证恢复；Emby Client 17 项、Gateway 22 项、Web 10 项单测、Playwright 认证闭环 1/1、`verify:local`、smoke 和迁移 up/down/up 全部通过 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | M1-008 |
| 2026-07-16 | M1-007 | 进行中 | 正在实现本地优先退出、Emby 会话注销、全局未认证恢复和浏览器闭环测试 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | 完成退出与 401 恢复验证 |
| 2026-07-16 | M1-006 | 完成 | 已实现 `/auth/me`、Emby 用户与权限刷新、会话权限持久化、未选服务器/未登录路由守卫和管理员能力导航；Emby Client 15 项、Gateway 18 项、Web 8 项测试及根级 format/check/build/smoke 全部通过 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | M1-007 |
| 2026-07-16 | M1-006 | 进行中 | 正在实现会话读取、Emby 用户状态刷新、路由守卫和管理员能力导航 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | 完成当前用户能力验证 |
| 2026-07-16 | M1-003～M1-005 | 完成 | 已实现 Emby 认证代理、精确 Origin 校验、IP/用户名十分钟五次限流、HttpOnly 会话、Cookie HMAC 摘要及 AES-256-GCM Token 存储；Contracts 5 项、Emby Client 12 项、Gateway 15 项、Web 5 项测试及类型/lint/格式检查通过 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | M1-006 |
| 2026-07-16 | M1-003～M1-005 | 进行中 | 正在原子实现 Emby 认证代理、限流、Origin 校验、HttpOnly Cookie 与 AES-256-GCM Token 存储 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | 完成安全认证闭环验证 |
| 2026-07-16 | M1-002 | 完成 | 已实现公共用户领域映射、头像二进制代理、服务器状态、用户卡片及登录表单的加载/空/错误状态；Emby Client 10 项、Gateway 11 项、Web 4 项及根级 check/build 通过 | `packages/contracts/src/auth.ts`, `packages/emby-client/src/public-users.ts`, `apps/web/src/routes/login.tsx` | M1-003～M1-005 |
| 2026-07-16 | M1-002 | 进行中 | 正在实现公共用户、头像代理和登录页面状态 | `packages/contracts`, `packages/emby-client`, `apps/gateway`, `apps/web` | 完成公共用户与页面验证 |
| 2026-07-16 | M1-001 | 完成 | 已实现当前服务器读取/选择契约、SQLite 持久化、允许列表探测、`/connect` 状态与 `/login` 跳转；迁移 up/down/up、真实 SQLite store、Gateway/Web 测试、根级 check、构建和本地 smoke 通过 | `packages/contracts`, `apps/gateway`, `apps/web/src/routes/connect.tsx` | M1-002 |
| 2026-07-16 | M1-001 | 进行中 | 正在实现当前服务器选择、持久化和 `/connect` 页面 | `packages/contracts`, `apps/gateway`, `apps/web` | 完成连接流程验证 |
| 2026-07-16 | M0-BASELINE | 完成 | Node 22.13 冻结安装、临时 SQLite 迁移、本地 Web/Gateway smoke、format、lint、typecheck、41 项单测、应用/Storybook 构建及 axe/视觉回归 2/2 全部通过；补齐 `.gitignore`、根 `.env` 加载和一键本地验证 | `.gitignore`, `scripts/local-smoke.mjs`, `README.md` | M1-001 |
| 2026-07-16 | M0-017 | 完成 | Storybook 已覆盖正常、加载、空、错误和禁用状态；修复收藏语义与强调色文字对比度；format、lint、typecheck、41 项单测、应用/Storybook 构建、axe/键盘/视觉回归 2/2 全部通过 | `packages/ui/.storybook`, `foundation.stories.tsx`, `visual/` | 等待 M0 外部发布门 |
| 2026-07-16 | M0-016 | 完成 | 已实现 PosterCard、ContinueWatchingCard、MediaRow、ImageFallback，覆盖进度、收藏、未看、懒加载和失败回退；19 项 UI 测试及 UI/Web 构建通过 | `packages/ui/src/media-*`, `image-fallback.tsx` | M0-017 |
| 2026-07-16 | M0-015 | 完成 | 已实现 Button、Input、Select、Dialog、Drawer、Toast、Skeleton、EmptyState、ErrorState、ConfirmDangerDialog；15 项 UI 测试、lint/typecheck 与 UI/Web 构建通过 | `packages/ui/src` | M0-016 |
| 2026-07-16 | M0-014 | 完成 | 已实现 240px 管理侧栏、64px 顶栏、面包屑、1440px 内容区与高密度概览骨架；AdminShell 语义测试、UI/Web 全量验证通过 | `packages/ui/src/admin-shell.tsx`, `apps/web/src/routes/admin.tsx` | M0-015 |
| 2026-07-16 | M0-013 | 完成 | 已实现 72/224px 前台侧栏、64px 上下文顶栏、跳转链接、Bridge/用户状态入口和应用路由布局；AppShell 语义测试、UI lint/build、Web typecheck/build 通过 | `packages/ui/src/app-shell.tsx`, `apps/web/src/routes/_app*` | M0-014 |
| 2026-07-16 | M0-012 | 完成 | UX 颜色、字体、4px 间距、圆角、阴影、断点、焦点与减弱动效已映射到 Tailwind 主题变量，并加入仓库自有 SVG 标志；8 项令牌/资源测试及 Web 构建通过 | `packages/ui/src/theme.css`, `newemby-mark.svg`, `apps/web/src/styles.css` | M0-013 |
| 2026-07-16 | M0-011 | 完成 | React 19、Vite 8、TanStack 文件路由、Query 默认缓存、Zustand UI 状态及开发 API 代理已初始化；路由树生成、单测、lint/typecheck/build 通过 | `apps/web` | M0-012 |
| 2026-07-16 | M0-010 | 完成 | 已加入虚构 PublicInfo/Ping fixture、递归敏感键和值脱敏及失败闭合检查；4 项 fixture 测试和适配包全量验证通过 | `packages/emby-client/fixtures`, `fixture-safety.ts` | M0-011 |
| 2026-07-16 | M0-009 | 完成 | 已实现允许列表保护的 Ping/PublicInfo 探测、子路径 URL 处理及不可达/TLS/超时/版本分类；Emby 适配 4 项与 Gateway 路由 3 项新增测试通过，真实目标服务器验证保留在 M0 发布门 | `packages/emby-client`, `apps/gateway/src/app.ts` | M0-010 |
| 2026-07-16 | M0-008 | 完成 | Kysely/better-sqlite3 迁移框架、单活动服务器约束和迁移 CLI 已建立；临时数据库 up/down/up 测试通过 | `apps/gateway/src/database` | M0-009 |
| 2026-07-16 | M0-007 | 完成 | Fastify Gateway 已实现健康检查、Request ID 透传/生成、敏感头脱敏结构化日志、统一错误和 OpenAPI 注册；4 项注入测试及 lint/typecheck/build 通过 | `apps/gateway/src` | M0-008 |
| 2026-07-16 | M0-006 | 完成 | `@newemby/contracts` 已集中导出 Zod Schema、TS 类型、路由契约和 OpenAPI 元数据；4 项契约测试及 lint/typecheck/build 通过 | `packages/contracts` | M0-007 |
| 2026-07-16 | M0-005 | 完成 | README 已记录分支、任务粒度、Conventional Commits、SemVer、里程碑版本和发布标签约定，格式检查通过 | `README.md` | M0-006 |
| 2026-07-16 | M0-004 | 阻塞 | GitHub Actions workflow 已配置 format、lint、typecheck、test、build、Storybook 和 Playwright 视觉回归；待首次远程运行通过后勾选 | `.github/workflows/ci.yml` | M0-005 |
| 2026-07-16 | M0-003 | 完成 | 已建立安全环境模板、开发说明、Compose/Caddy 同源生产模式和容器构建文件；变量完整性与跟踪规则检查通过，Docker 实构建待发布门验证 | `.env.example`, `compose.yaml`, `deploy/`, `README.md` | M0-004 |
| 2026-07-16 | M0-002 | 完成 | TypeScript 共享配置、ESLint flat config、Prettier 和 EditorConfig 已建立；lint、format check、typecheck 通过 | 根配置、`packages/config` | M0-003 |
| 2026-07-16 | M0-001 | 完成 | 7 个 workspace 边界、根命令和锁文件已建立；安装及 lint/typecheck/test/build 统一检查通过 | `apps/`, `packages/`, `package.json`, `pnpm-lock.yaml` | M0-002 |
| 2026-07-16 | D0-006 | 完成 | 已确定正式名称、应用 ID、协议、强调色和 Logo 来源；D0 发布门通过 | `docs/PROJECT_PLAN.md`, `docs/UX_SPEC.md` | M0-001 |
| 2026-07-16 | D0-005 | 完成 | 首版固定单服务器，契约、数据库与缓存键预留 `serverId`，多服务器延期到 M6 | `docs/PROJECT_PLAN.md` | D0-006 |
| 2026-07-16 | D0-004 | 完成 | 已确定 HTTPS、同源反向代理、可信 Origin、Cookie 和代理信任策略 | `docs/PROJECT_PLAN.md` | D0-005 |
| 2026-07-16 | D0-003 | 完成 | 已补充公网浏览器、同源 Web/Gateway、现有公网 Emby 与 SQLite 的最终部署图和环境变量清单 | `docs/PROJECT_PLAN.md` | D0-004 |
| 2026-07-16 | D0-003 | 进行中 | 正在补充最终部署图和环境变量清单 | `docs/` | 完成部署拓扑文档 |
| 2026-07-16 | DOC-001, DOC-002 | 完成 | 规划、视觉规范和设计稿已写入仓库 | `docs/`, `images/` | 完成 D0 |
| 2026-07-16 | D0-001, D0-002 | 完成 | 确认 Windows 首发及 PotPlayer 第一适配 | 三份规划文档 v1.1 | 完成 D0-003 至 D0-006 |

## 16. 发布记录

| 版本 | 日期 | 覆盖阶段 | 状态 | 发布说明 |
|---|---|---|---|---|
| v0.1.0 | 待定 | M0–M1 | 未发布 | 媒体浏览 MVP |
| v0.2.0 | 待定 | M2 | 未发布 | Windows PotPlayer + SMTC 本地播放闭环 |
| v0.3.0 | 待定 | M3 | 未发布 | 前台体验完善 |
| v0.4.0 | 待定 | M4 | 未发布 | 管理后台基础 |
| v0.5.0 | 待定 | M5 | 未发布 | 媒体与运维管理 |
| v1.0.0 | 待定 | M6 范围确认后 | 未发布 | 稳定正式版 |
