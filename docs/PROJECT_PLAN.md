# NewEmby 项目详细规划

> 文档状态：已确认方案 v1.2  
> 产品形态：现代化 Emby Web 客户端 + 本地播放器桥接 + 管理后台  
> 核心约束：不实现 Web 视频播放器

## 1. 项目定义

NewEmby 不是另一个媒体服务器，也不接管 Emby 的媒体扫描、用户、
元数据和权限系统。它是覆盖在 Emby API 之上的新客户端体验。

系统由三部分组成：

1. Web 客户端：媒体发现、搜索、详情、收藏、播放入口和后台管理。
2. NewEmby Gateway：统一登录、会话保护、API 适配和本地播放票据。
3. Player Bridge：由用户在电脑上直接运行的便携应用，唤起本地播放器并回传
   播放进度。

### 1.1 产品目标

- 提供明显优于 Emby Web 的视觉和浏览体验。
- Windows 首版优先使用 PotPlayer 完成实际播放，mpv 作为第二适配器。
- 正确同步开始播放、暂停、进度、停止和播放完成状态。
- 保留 Emby 多用户、权限、收藏、播放历史和媒体库能力。
- 最终覆盖常用 Emby 管理员功能。
- 优先完成桌面浏览器，随后适配移动端和电视端。

### 1.2 明确不做

- 不实现 HTML5 视频播放器。
- 不自行转码或维护媒体索引。
- 不复制 Emby 数据库。
- 不把管理员 API Key 写入浏览器。
- 首版不做离线下载、投屏、Live TV 和音乐播放。
- 首版不承诺代替 Emby 原生后台的所有冷门设置。

## 2. 用户与权限

### 2.1 普通用户

- 登录自己的 Emby 账户。
- 浏览被授权的媒体库。
- 搜索、收藏、标记已看和管理播放列表。
- 调用本地播放器。
- 查看和恢复自己的播放进度。
- 设置默认播放器、字幕、音轨和播放行为。

### 2.2 管理员

拥有普通用户所有能力，并可进入 `/admin`：

- 查看服务器健康状态、磁盘、版本和活动。
- 查看和控制活动会话。
- 管理用户、权限和设备。
- 管理媒体库路径及扫描。
- 编辑媒体元数据、图片并触发刷新。
- 管理计划任务、插件、日志、API Key 和服务器设置。

管理员路由必须同时通过前端路由守卫和 Gateway 服务端权限校验。

## 3. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│ React UI ── /api/* ───────────────────────────────────────┐  │
│    │                                                      │  │
│    └── http://127.0.0.1:{port} ── Player Bridge           │  │
└───────────────────────────────────────────────────────────│──┘
                                                            │
                       HTTPS / HttpOnly Cookie              │
                                                            ▼
┌──────────────────────────────────────────────────────────────┐
│ NewEmby Gateway                                               │
│ Session · Emby Adapter · Play Ticket · Audit · Admin Guard    │
└───────────────────────────────┬──────────────────────────────┘
                                │ X-Emby-Token
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ Emby Server                                                   │
│ Users · Libraries · Metadata · Images · Sessions · Progress   │
└──────────────────────────────────────────────────────────────┘

Player Bridge ── Windows SMTC ── PotPlayer
              └─ adapter IPC ─── mpv / VLC / other adapters
Player Bridge ── one-time ticket ── Gateway ── media URL / Emby
```

### 3.1 为什么需要 Gateway

- 避免把 Emby AccessToken 暴露给页面脚本和播放器命令行。
- 统一解决 CORS、HTTPS 和多个 Emby 服务器地址的问题。
- 为本地播放器签发短时、一次性播放票据。
- 对不同 Emby 版本的字段差异提供统一适配层。
- 对管理员高风险操作增加审计、确认和防重放。

### 3.2 为什么需要 Player Bridge

浏览器自定义协议只能打开应用，不能可靠读取播放器的暂停、跳转、
播放结束和错误状态。Player Bridge 提供以下能力：

- 注册 `newemby://` 自定义协议。
- 在回环地址启动只监听本机的 HTTP 服务。
- 首版检测 PotPlayer、其版本及 Windows SMTC 是否启用。
- 通过 Windows Global System Media Transport Controls 读取 PotPlayer 的
  播放、暂停、时间线、跳转和媒体切换状态。
- 后续通过 mpv JSON IPC 或 VLC 控制接口接入其他播放器。
- 把播放器事件转换为 Emby Playback Check-ins。
- 退出播放器、浏览器关闭或网络中断时补发 Stopped。
- 处理续播位置、音轨、字幕和下一集。

### 3.3 首版服务器范围

- 首版部署只允许一个当前 Emby Server，不提供服务器切换界面。
- `EMBY_BASE_URL` 提供默认服务器，`/connect` 只允许选择部署配置中
  `EMBY_ALLOWED_SERVER_ORIGINS` 声明的地址。
- SQLite 使用 `servers` 表保存服务器 ID、地址、版本和能力探测结果，
  业务表和缓存键从一开始携带 `server_id`。
- 更换当前服务器前必须退出登录并清理原服务器会话，不能复用 Token。
- 最近服务器列表、并行会话和快速切换延期到 M6 多服务器阶段。

## 4. 本地播放完整流程

### 4.1 首次配对

1. Web 客户端请求 `GET http://127.0.0.1:{port}/v1/status`。
2. 未下载或未运行时展示便携版下载、放置和启动说明，不静默失败。
3. Bridge 返回版本、平台、已发现播放器和配对状态。
4. 用户点击“配对”，Gateway 生成 60 秒有效的配对码。
5. Bridge 用配对码换取设备凭证，保存到系统凭据存储。
6. Gateway 记录设备名称、系统、Bridge 版本和最后活动时间。

配对码由 `POST /api/v1/bridge/pairing-codes` 签发。该接口要求当前 Emby
登录会话、精确 Origin 和 CSRF Token，返回 `pairingCode`、`expiresAt` 与固定
的 `expiresInSeconds: 60`。配对码使用 32 字节随机值，明文只在签发响应中出现；
Gateway 仅保存绑定认证会话的 HMAC 摘要。同一会话重复签发时旧码立即失效，
Bridge 的一次性兑换和设备凭证由 `M2-008` 完成。

Bridge 通过 `POST /api/v1/bridge/pairings/redeem` 提交配对码、设备名称、平台和
Bridge 版本。Gateway 在同一 SQLite 事务中删除配对码、创建设备并签发 32 字节
设备凭证；过期、未知和已兑换的配对码统一返回 `PAIRING_CODE_INVALID`，不泄露
具体状态。设备凭证明文只在该响应中出现，Gateway 只保存 HMAC 摘要。Windows
Bridge 将 Gateway Origin、设备 ID、凭证和允许来源保存到当前用户的 Credential
Manager Generic Credential，不写入文件、注册表、命令行或日志。

已配对 Bridge 调用 Gateway 时使用 `Authorization: NewEmbyDevice <credential>`
和 `X-NewEmby-Nonce`。`POST /api/v1/bridge/devices/:deviceId/heartbeat` 作为首个
认证探针；Gateway 只保存 nonce 的 HMAC 摘要，并以设备 ID + 摘要唯一约束提供
跨进程、跨重启的五分钟重放窗口。无效凭证、非法 nonce 和重放分别返回
`BRIDGE_CREDENTIAL_INVALID`、`NONCE_INVALID` 和 `REPLAY_DETECTED`。

当前登录用户通过 `GET /api/v1/bridge/devices` 读取当前 Emby Server、当前用户
名下尚未撤销的设备；`DELETE /api/v1/bridge/devices/:deviceId` 同时要求精确
Origin 和 CSRF，只能撤销同一 Server、同一用户拥有的设备，跨用户查询统一按
不存在处理。Bridge 可使用设备凭证和新 nonce 调用
`DELETE /api/v1/bridge/devices/:deviceId/credential` 自撤销。服务器发生实际切换
时，Gateway 会撤销旧服务器的全部 Bridge 设备；已撤销设备不能再通过心跳或
后续设备认证。

便携 Bridge 的 `--unpair` 先请求 Gateway 自撤销，成功或 Gateway 已返回 401
时才删除 Windows Credential Manager 中的本地凭证；其他上游失败保留本地
凭证以便重试。网页解除配对应先完成 Gateway 撤销，再以允许 Origin 和新 nonce
调用回环 `DELETE /v1/pairing` 清除本机凭证，避免只清本地却留下可用的远端设备。

浏览器访问 Bridge 回环服务时，带 Origin 的请求必须与配对时下发的来源逐字
匹配；未配对或其他网页不能获得 CORS 授权。无 Origin 的只读状态请求保留给
本机诊断，状态写请求必须同时具有允许 Origin 和 22–128 字符的 Base64URL
nonce。Bridge 以内存五分钟窗口拒绝重放，并支持 Private Network Access
预检；`POST /v1/pairing/verify` 用于验证这条安全边界。

### 4.2 点击播放

1. Web 端打开“播放准备”弹层。
2. Gateway 通过当前用户级 `/Items/{id}/PlaybackInfo` 获取可直接播放的
   媒体源、音轨和文本字幕；默认值由 Emby 返回值决定。
3. 用户确认版本、字幕和音轨；M2 只支持 PotPlayer，高级多版本体验留到 M3。
4. Web 向 Gateway 请求一次性 `PlayTicket`。
5. Web 以配对 Origin 和新 nonce 调用 Bridge 的 `POST /v1/playback/start`。
6. Bridge 使用设备凭证一次兑换票据并在内存保存播放选择。
7. Bridge 启动 PotPlayer；播放器只读取 Bridge 回环媒体/字幕 URL，Bridge 再以
   设备凭证访问 Gateway，Gateway 恢复加密 Emby 会话并代理静态直流。
8. Bridge 确认播放器开始读取文件后报告 Playing。
9. 每 10 秒报告一次 Progress；暂停、恢复、跳转立即报告。
10. 正常结束、用户退出或进程异常退出时报告 Stopped。
11. Web 轮询 Bridge 的本地真实状态显示“正在本地播放”。

播放准备与流代理的浏览器响应、本地回环 URL、PotPlayer 命令行均不包含 Emby
AccessToken。Gateway 在签发票据前重新校验媒体源和音字幕选择，Bridge 的本地
播放会话只存在于进程内；字幕仅允许 Emby 标记为文本的流。

### 4.3 PlayTicket 设计

`M2-011` 将票据固定为版本化不透明字符串
`pt1.<ticket_id>.<32-byte Base64URL secret>`。`ticket_id` 只用于定位记录，不是
认证凭据；随机 secret 的明文只允许出现在签发响应和后续一次兑换请求中，
Gateway 仅持久化带域分隔的 HMAC-SHA256 摘要。票据记录包含或关联：

```text
ticket_id
secret_hash
user_session_id
bridge_device_id
server_id
emby_user_id
emby_item_id
media_source_id
play_session_id
resume_ticks
audio_stream_index
subtitle_stream_index
created_at
expires_at
redeemed_at
```

安全要求：

- 票据有效期不超过 60 秒，数据库同时约束创建与过期时间顺序。
- `redeemed_at` 初始为空；票据只允许兑换一次。
- 必须绑定 Bridge 设备和当前登录用户。
- 续播 Ticks 必须为 JavaScript 安全范围内的非负整数，音轨和字幕索引必须为空
  或非负整数。
- 播放命令行不出现 Emby AccessToken。
- Bridge 回环服务校验 Origin、配对凭证和请求 nonce。
- 回环服务只监听 `127.0.0.1` 和 `::1`。
- Gateway 对进度数值做范围及单调性检查。

`M2-012` 提供两个 Gateway 接口：

- `POST /api/v1/bridge/play-tickets`：当前 Web 登录会话提交 `deviceId`、
  `itemId`、`mediaSourceId`、`resumeTicks`、`audioStreamIndex` 和
  `subtitleStreamIndex`。接口要求精确 Origin、CSRF，并在同一事务内确认会话和
  未撤销设备属于同一 Server、同一 Emby 用户；成功返回 `playTicket`、
  `playSessionId`、`expiresAt` 和固定 `expiresInSeconds: 60`。
- `POST /api/v1/bridge/devices/:deviceId/play-tickets/redeem`：Bridge 提交
  `playTicket`，同时使用 `NewEmbyDevice` 设备凭证与新 nonce。Gateway 原子写入
  `redeemedAt` 后返回 `playSessionId` 和播放选择；响应不包含 Emby AccessToken、
  设备凭证或票据摘要。

未知、格式错误、过期、已兑换、错误 secret、跨设备票据及已失效登录会话在
兑换边界统一返回 `PLAY_TICKET_INVALID`，不披露具体状态。并发兑换由事务和
`redeemedAt is null` 条件共同保证只有一次成功。签发与兑换均限流；已兑换记录
保留到原始 60 秒有效期结束，以便诊断并拒绝重放，签发时和 Gateway 启动时清理
已过期票据。

### 4.4 播放状态机

```text
IDLE
  └── PREPARING
        ├── FAILED
        └── LAUNCHING
              ├── FAILED
              └── PLAYING
                    ├── PAUSED
                    ├── SEEKING ── PLAYING
                    ├── ERROR
                    └── STOPPED ── IDLE
```

必须防止同一次播放重复发送 Playing 和 Stopped。所有回传请求带
`play_session_id` 和递增的事件序号，Gateway 幂等处理。

每个 PlaySession 的事件序号必须从 1 严格递增。Gateway 在调用 Emby 前，
先以 `playSessionId + sequence` 和规范化负载指纹原子声明事件；已完成的相同
事件直接返回成功，序号冲突、跳号或终态后的新事件返回冲突。只有 Emby 成功
接收后才原子完成事件并推进会话序号，上游失败会释放声明供同一事件重试。
Bridge 在进程生命周期内按会话串行暂存待发送事件，网络超时、限流和临时服务
错误使用同一序号与负载、但使用新 nonce 重试；便携版 Bridge 重启后不承诺恢复
未发送队列。

### 4.5 播放器适配优先级

1. PotPlayer：Windows 首版播放器。使用命令行完成 URL、续播、字幕和
   标题传递，使用 Windows SMTC 获取播放状态和时间线。
2. mpv：第二适配器。使用 JSON IPC，作为跨平台和高可靠控制方案。
3. VLC：后续适配，通过可验证的控制接口实现。
4. 用户自定义命令：只能保证启动，进度同步标记为“不受支持”。

首版验收以 PotPlayer 为准。开发完整适配前必须先完成 SMTC 技术验证，
确认暂停、拖动、媒体结束、多实例和异常退出能够被可靠识别。若 PotPlayer
关闭了“Use system media transport control”，Bridge 必须提示用户启用，
不能降级为伪造的计时进度。

首版 PotPlayer 最低支持版本锁定为 `1.7.22398.0`，该版本已在 Windows
build 26100 完成发现、启动、GSMTC 来源及 `/title` 媒体属性实测；更低版本
不进入正式兼容范围。

Bridge 只从运行中进程、Windows App Paths、DAUM 安装信息和有界标准目录
发现 PotPlayer，并校验为实际存在的受支持可执行文件。重复路径合并后优先
运行中实例，其次优先 x64。状态接口只公开版本、架构和运行状态；安装路径
仅保留在 Bridge 内部供安全启动使用。若启动器版本为占位的 `0.0.0.0`，
版本读取回退到同一可信目录的 PotPlayer 核心 DLL。

PotPlayer 启动参数只允许携带短时 PlayTicket 或本地 Bridge URL，不能把
Emby AccessToken 放入 `/headers`、媒体 URL 或进程命令行。Bridge 使用
`/seek` 设置续播位置，并用 `/title` 加入短播放会话标识，帮助匹配由
NewEmby 启动的 SMTC 会话。

实际进程启动固定使用 `UseShellExecute=false` 和逐项 `ArgumentList`，禁止
拼接命令行字符串。媒体与外置字幕参数只接受配置端口上的字面量 IPv4/IPv6
回环 HTTP URL，路径必须分别匹配当前播放会话的
`/v1/playback/<play_session_id>/media` 与 `.../subtitle`，且不得带用户信息、
查询参数或片段。`/new` 固定启用；非零续播点转换为
`/seek=HH:MM:SS.mmm`；`/title` 只包含 NewEmby 前缀和规范播放会话 UUID，
不接受媒体标题等可注入文本。

Bridge 在进程创建成功后记录进程 ID、启动时间和 PlaySessionId。GSMTC
匹配只接受仍为同一存活进程、来源是受支持 PotPlayer 标识且媒体标题精确等于
`NewEmby:<play_session_id>` 的唯一候选；单一但标题不符的会话不得猜测绑定，
重复精确候选必须标记为歧义。匹配在会话和媒体属性事件后刷新，并使用一秒
轮询兜底；15 秒内没有候选标记为超时，进程退出或 PID 已复用则立即失效。
多实例通过不同 PlaySessionId 隔离，匹配到的内部会话句柄不得通过状态 API
公开，并由后续时间线和停止流程显式解除跟踪。

匹配成功后，Bridge 同时读取 GSMTC PlaybackInfo 和 TimelineProperties，
将开始、结束、位置及可跳转范围归一化为相对媒体起点的非负 Ticks，并保留
最后更新时间与播放速率。偏离按更新时间和速率计算的预期位置超过两秒时标记
为跳转；`Playing` 时间线超过五秒未更新时标记为陈旧，不能继续声称完整同步。
PotPlayer 在自然结束时可能短暂保留 `Playing` 却将时间线归零，因此 Bridge
需要保留上一份有效快照：接近末尾后归零，或在距末尾两秒内收到
`Stopped`/`Closed`，统一归一化为 `Ended`。播放与时间线事件立即刷新，一秒
轮询仅作为漏事件兜底；M2-017 不提前发送 Emby 回传。

PlayTicket 兑换成功时，Gateway 将授权会话、Bridge 设备、Server、用户、媒体项、
媒体源、续播点和音字幕选择固化为独立 PlaybackSession；原始短时票据过期后不会
影响长时间播放。Bridge 观察到新鲜的 Playing 或 Paused 时间线后，只向
`POST /api/v1/bridge/devices/:deviceId/playback-events` 提交设备凭证、一次性 nonce、
PlaySessionId、位置、暂停状态和速率。Gateway 必须校验设备与播放会话绑定，从
AES-256-GCM 加密的登录会话恢复 AccessToken，再调用 Emby `/Sessions/Playing`；
AccessToken 不进入 Bridge、浏览器、URL、日志或错误响应。同一 Bridge 进程对每个
PlaySessionId 只发送一次 Playing，陈旧时间线不得触发开始回传，失败可在下一次
播放器状态变化时重试。

Playing 成功后，Bridge 使用独立 10 秒周期读取最新快照并发送 `progress` /
`timeUpdate`；Gateway 映射为 Emby `/Sessions/Playing/Progress` 的 `TimeUpdate`，
同时保存最后位置和事件时间。心跳沿用 Playing 的完整媒体、音字幕、暂停与速率
上下文。播放会话尚未开始时 Gateway 必须拒绝 Progress；匹配消失或时间线陈旧时
Bridge 立即停止心跳，单次网络失败只影响当前心跳并在下一周期重试。

Bridge 对同一 PlaySessionId 保存上一份已处理快照：Playing→Paused 立即发送
`Pause`，Paused→Playing 立即发送 `Unpause`，跳转标志与位置变化立即发送本地
`seek` 并由 Gateway 映射为 Emby `TimeUpdate`，速率变化发送
`PlaybackRateChange`。这些交互回传不等待下一次 10 秒心跳。GSMTC 不提供当前
音轨或字幕轨索引，因此 Bridge 不得猜测；轨道变化由受控本地播放交互接口显式
提交 `AudioTrackChange` / `SubtitleTrackChange`，Gateway 仅在 Emby 接受后更新
PlaybackSession 中的轨道选择，字幕索引 `null` 表示关闭字幕。

已成功 Playing 的会话进入 Ended 时以最后有效位置发送 `Stopped`（reason
`ended`）；进入 Stopped/Closed 时按播放器主动退出发送（`userExit`）；匹配快照
中消失时按播放器进程或会话异常退出发送（`playerExit`）。Bridge 优雅关闭前还会
为仍活跃会话尽力补发 `bridgeExit`。Stopped 使用与 Playing 相同的授权媒体上下文
调用 Emby `/Sessions/Playing/Stopped`，成功后原子写入 PlaybackSession 的最终位置
和停止时间；同一 Bridge 进程对一个 PlaySessionId 只确认一次成功 Stopped，失败
保留为未停止，供后续终态观察或离线队列重试。

## 5. 前台信息架构

### 5.1 全局导航

桌面端使用左侧窄导航栏：

- 首页
- 电影
- 剧集
- 媒体库
- 收藏
- 播放列表
- 管理后台（仅管理员）
- 设置

顶部上下文栏提供返回、当前栏目标题、可展开的全局搜索、Bridge 状态和
用户菜单。搜索遵循 `emby-win` 的 `SearchDropdown`，不占用独立导航标签。

### 5.2 页面清单与验收范围

#### P01 服务器连接页 `/connect`

- 服务器地址输入。
- 首版只显示当前允许的服务器；最近服务器列表随 M6 多服务器实现。
- 局域网发现作为后续增强。
- HTTPS、版本、连接延迟和证书错误反馈。
- 成功后读取 `/System/Info/Public` 并进入登录。

#### P02 登录页 `/login`

- 服务器名称和状态。
- 公共用户头像选择。
- 用户名密码登录。
- 记住当前服务器，不保存明文密码。
- 错误次数限制及清晰的 401/网络错误区分。

#### P03 首页 `/home`

- 采用 `UX_SPEC.md` 指定的 `emby-win` 横向轨道视觉基线。
- 继续观看：196px 横向宽卡，显示真实进度和 Hover 播放反馈。
- 我的媒体库：196px 横卡并进入当前用户授权视图。
- 最近添加电影、最近更新剧集、收藏和智能类型栏目使用 160px 海报卡。
- 轨道支持隐藏滚动条、左右翻页、平滑滚动和带误点击保护的鼠标拖拽。
- Bridge 离线时使用非阻塞状态提示。

#### P04 电影库 `/movies`

- 海报网格和紧凑列表两种视图。
- 类型、年份、分级、评分、已看、收藏筛选。
- 名称、发行日期、加入日期和评分排序。
- URL 保存筛选状态。
- 分页或虚拟滚动，返回时恢复滚动位置。

#### P05 剧集库 `/series`

- 与电影库共享筛选框架。
- 额外支持继续更新、完结状态和未看集数。
- 海报卡突出未看集数和最新一集日期。

#### P06 顶栏搜索（`/search` 仅兼容重定向）

- 顶栏图标展开紧凑胶囊输入框，250ms 防抖即时搜索。
- 浮层显示电影和剧集的封面、名称、年份与类型，选择后进入详情。
- 支持 Escape、清除按钮、点击外部关闭和完整键盘导航。
- 不再渲染独立搜索页；旧 `/search` 地址安全返回首页。

#### P07 电影详情 `/item/:id`

- 大背景、海报、Logo、元数据和简介。
- 播放、继续播放、从头播放。
- 收藏、已看、加入播放列表。
- 演职人员、媒体信息、版本和相关推荐。
- 管理员可进入“编辑元数据”。

#### P08 剧集详情 `/item/:id`

- 剧集头部信息。
- 季选择器。
- 单集列表、缩略图、简介、时长和进度。
- “播放下一未看集”和“从第一集开始”。
- 季级别收藏与已看操作。

#### P09 人物详情 `/person/:id`

- 人物头像、简介和基础信息。
- 出演、导演、编剧作品分组。
- 当前用户媒体库内结果优先。

#### P10 收藏 `/favorites`

- 电影、剧集、单集和人物分栏。
- 复用媒体库筛选、排序和卡片。

#### P11 播放列表 `/playlists`

- 播放列表列表、详情、排序和移除。
- 创建、重命名、删除。
- 连续播放由 Bridge 维护当前队列。

#### P12 本地播放准备弹层

- 显示 Bridge 在线状态和版本兼容性。
- 选择播放器、文件版本、音轨、字幕。
- 显示续播位置。
- “继续播放”和“从头播放”。
- 启动失败时提供诊断信息和重试。

#### P13 当前播放浮层

- 显示标题、播放器、当前时间、总时长和状态。
- 提供暂停、继续、停止、打开播放器窗口。
- Bridge 断开时展示最后状态，不伪造播放成功。
- 点击进入播放会话详情和诊断。

#### P14 用户设置 `/settings`

- 默认播放器。
- 默认播放行为。
- 首选音频语言和字幕语言。
- 自动选择字幕、强制字幕策略。
- 主题、密度、动效和海报尺寸。
- Bridge 配对设备列表和解除配对。

## 6. 管理后台信息架构

管理后台与观影前台共享设计令牌，但采用更高信息密度、固定侧栏和
面包屑，不使用大幅媒体背景。

### 6.1 A01 管理概览 `/admin`

- 服务器版本、运行时间、地址和更新状态。
- CPU、内存、磁盘和媒体库数量。
- 当前活动会话。
- 最近活动日志。
- 扫描或计划任务进度。
- 快捷操作：扫描媒体库、查看日志、管理用户。

### 6.2 A02 活动会话 `/admin/sessions`

- 用户、设备、IP、客户端版本和最后活动。
- 当前播放条目和进度。
- 发送消息、停止播放和远程控制。
- Bridge 会话与 Emby 原生会话使用不同徽标区分。

### 6.3 A03 用户管理 `/admin/users`

- 用户列表、状态、最后登录、策略摘要。
- 新增、禁用、删除和重置密码。
- 媒体库访问、远程访问、设备和播放权限。
- 管理员权限变更要求二次确认。

### 6.4 A04 媒体库管理 `/admin/libraries`

- 虚拟媒体库和路径。
- 内容类型、语言、国家、元数据与图片抓取器。
- 添加、删除和修改路径。
- 启动扫描并显示任务进度。
- 删除媒体库前展示影响范围并要求输入确认。

### 6.5 A05 元数据管理 `/admin/metadata`

- 从媒体详情进入单项编辑。
- 编辑标题、排序名、简介、年份、类型、分级和 Provider IDs。
- 查看、选择、上传和删除图片。
- 刷新元数据并选择替换范围。
- 所有写入操作写入 NewEmby 审计记录。

### 6.6 A06 计划任务 `/admin/tasks`

- 任务名称、状态、上次结果、耗时和下次执行。
- 启动、停止及修改触发器。
- 运行中的任务展示实时进度。

### 6.7 A07 插件 `/admin/plugins`

- 已安装插件、版本和状态。
- 插件详情和配置入口。
- 安装、更新、禁用和卸载属于后期能力。
- 插件返回的动态配置页先使用受控 JSON 表单，不渲染不可信 HTML。

### 6.8 A08 设备与 API Key `/admin/access`

- 已登录设备和最后活动。
- 删除设备。
- API Key 创建、撤销和用途备注。
- Key 只在创建成功后完整显示一次。

### 6.9 A09 日志与活动 `/admin/logs`

- 活动日志时间线。
- 服务日志列表、级别筛选、搜索和下载。
- 错误上下文展示，但对普通管理员隐藏敏感 Token。

### 6.10 A10 服务器设置 `/admin/settings`

- 通用、网络、远程访问、转码、字幕、数据库和高级设置。
- 高风险项独立分组，保存前展示差异。
- 重启、关机等操作使用不可误触的确认流程。
- Gateway 不认识的字段必须原样保留，避免覆盖丢失。

## 7. Emby API 适配规划

| 领域 | 典型接口 | 阶段 |
|---|---|---|
| 服务器检测 | `/System/Info/Public`, `/System/Ping` | M1 |
| 登录退出 | `/Users/AuthenticateByName`, `/Sessions/Logout` | M1 |
| 用户媒体库 | `/Users/{id}/Views`, `/Users/{id}/Items` | M1 |
| 最近内容 | `/Users/{id}/Items/Latest` | M1 |
| 详情和图片 | `/Users/{id}/Items/{id}`, `/Items/{id}/Images/*` | M1 |
| 收藏及已看 | `/FavoriteItems/*`, `/PlayedItems/*` | M1 |
| 播放源 | `/Items/{id}/PlaybackInfo` | M2 |
| 播放回传 | `/Sessions/Playing`, `/Progress`, `/Stopped` | M2 |
| 会话 | `/Sessions` 及会话控制接口 | M4 |
| 用户管理 | `/Users`, 用户策略和密码接口 | M4 |
| 媒体库管理 | `/Library/VirtualFolders*`, 扫描接口 | M5 |
| 元数据 | `/Items/{id}`, `/Items/{id}/Refresh`, 图片接口 | M5 |
| 计划任务 | `/ScheduledTasks*` | M5 |
| 设备与 Key | `/Devices`, `/Auth/Keys` | M5 |
| 活动和日志 | `/System/ActivityLog/Entries`, `/System/Logs/*` | M5 |
| 系统设置 | `/System/Configuration`, `/System/Restart` | M6 |

接口类型不直接泄露到页面。Gateway 和 Web 共用一套领域模型：

```text
ServerSummary
UserProfile
MediaLibrary
MediaCard
MediaDetail
SeasonSummary
EpisodeSummary
PersonSummary
MediaSource
PlaybackSession
BridgeDevice
AdminSession
AdminTask
AdminAuditEntry
```

每个 Emby Server 版本在首次连接时记录版本号，并执行只读能力探测。
前端根据 Capability Flags 隐藏不可用功能，而不是等待接口报错。

## 8. 技术选型

### 8.1 Monorepo

```text
apps/
  web/                 React + TypeScript + Vite
  gateway/             Gateway 服务
  player-bridge/       本地桥接程序
packages/
  contracts/           API schema 与领域类型
  emby-client/         Emby API 适配器
  ui/                  设计系统组件
  config/              lint、测试和构建配置
docs/
```

### 8.2 Web

- React + TypeScript + Vite。
- TanStack Router：类型安全路由和 URL 筛选状态。
- TanStack Query：服务端状态缓存、重试和失效。
- Zustand：只存 UI、Bridge 和当前播放会话状态。
- Radix UI primitives + 自有样式层。
- CSS Variables + CSS Modules 或 Tailwind。
- Zod：运行时校验 Gateway 响应。

### 8.3 Gateway

首选 TypeScript + Fastify，原因是前后端可共享 schema、开发速度快，
且本项目不代理浏览器视频流。若未来要求超低资源单文件部署，再评估 Go。

- HttpOnly、Secure、SameSite Cookie。
- SQLite 保存服务器、加密 Token、Bridge 设备和审计记录。
- 数据库字段级加密，密钥来自部署环境而非仓库。
- OpenAPI 作为 Web 与 Bridge 的契约源。
- 结构化日志，所有请求具有 Request ID。

### 8.4 Player Bridge

Windows 首版建议使用 C# / .NET 8：

- 运行基线固定为 Windows 10 version 2004（build 19041）或更新版本；
  GSMTC API 自 Windows 10 version 1809 可用，项目 TFM 与发布基线统一使用
  `windows10.0.19041.0`。
- 可直接使用 `Windows.Media.Control` 访问系统媒体会话和时间线。
- 适合实现进程控制、自定义协议、系统托盘和 Windows 便携发布；安装流程延期
  评估。
- 使用 self-contained single-file 发布，不要求用户预装 .NET Runtime。
- 播放器能力通过 `IPlayerAdapter` 隔离；PotPlayer 为首个实现，mpv 为
  第二实现。
- Windows 首发；macOS、Linux 在 Bridge 协议稳定后使用平台适配层跟进。

Bridge 只提供极简托盘界面，复杂配置仍在 Web 中完成。

## 9. 状态和缓存策略

- Emby 数据属于服务端状态，统一交给 TanStack Query。
- 登录会话只由 Gateway Cookie 表示，Web 不保存 Token。
- 首页查询缓存 60 秒，详情缓存 5 分钟。
- 图片 URL 加入 Emby Image Tag 形成不可变缓存键。
- 收藏、已看操作使用乐观更新，失败后回滚。
- 进度回传以 Bridge 为真源，浏览器仅作实时展示。
- Gateway 不永久缓存媒体详情，避免和 Emby 元数据不同步。

## 10. 错误与空状态

统一错误分类：

- `SERVER_UNREACHABLE`
- `AUTH_REQUIRED`
- `ACCESS_DENIED`
- `BRIDGE_NOT_FOUND`
- `BRIDGE_VERSION_UNSUPPORTED`
- `PLAYER_NOT_FOUND`
- `PLAY_TICKET_EXPIRED`
- `MEDIA_SOURCE_UNAVAILABLE`
- `PLAYER_LAUNCH_FAILED`
- `PLAYER_IPC_LOST`
- `EMBY_WRITE_FAILED`

错误提示必须告诉用户下一步，例如“下载并启动 Bridge”“重新配对”“选择其他
播放器”“重新登录”，不能只显示“发生错误”。

## 11. 测试策略

### 11.1 单元测试

- Emby DTO 到领域模型的转换。
- Ticks 与秒的转换。
- 播放状态机与事件幂等。
- 筛选条件与 URL 编解码。
- 用户权限和管理员守卫。

### 11.2 契约测试

- 用录制后脱敏的 Emby 响应作为 fixtures。
- 在受控测试服务器上运行只读 API smoke tests。
- 管理写操作使用独立测试媒体库和用户。
- 支持至少两个仍在使用的 Emby Server 小版本。

### 11.3 端到端测试

- 连接、登录、首页、筛选、详情和收藏。
- Bridge 未下载或未运行、未配对、版本过旧。
- PotPlayer 启动、SMTC 会话匹配、暂停、拖动、结束和异常退出。
- PotPlayer 已关闭 SMTC、多实例和会话匹配失败的恢复流程。
- Emby 暂时不可用后的进度补偿。
- 管理员与普通用户路由隔离。

### 11.4 播放兼容样本

- MP4、MKV、AVI。
- H.264、HEVC、AV1。
- 多音轨、多字幕。
- SRT、ASS、PGS。
- 本地网络路径和 HTTP 媒体 URL。
- 电影、多版本电影、剧集连续播放。

## 12. 迭代里程碑

### M0：基础设施与设计系统

- Monorepo、CI、代码规范和环境配置。
- 设计令牌、基础组件和 Storybook。
- Gateway 健康检查和 Emby 连接探测。
- API fixtures 和测试框架。

验收：可以连接测试 Emby，基础页面和组件可独立预览。

### M1：媒体浏览 MVP

- 连接、登录、首页、电影库、剧集库。
- 搜索、电影详情、剧集详情。
- 收藏、已看和图片缓存。
- 桌面响应式布局。

验收：不依赖 Emby 原 Web 页面完成媒体发现和管理。

### M2：PotPlayer 本地播放闭环

- Windows Bridge 便携发布与配对。
- PotPlayer 发现、版本检查和命令行启动。
- Windows SMTC 能力检查、会话匹配和时间线监听。
- PlayTicket。
- 续播、进度回传和播放完成。
- 播放准备弹层和当前播放浮层。

验收：PotPlayer 暂停、拖动、正常退出和异常退出后，Emby 中的进度误差
不超过 15 秒；SMTC 关闭时阻止进入“完整同步”状态并提供启用说明。

便携版 Bridge 正常启动时刷新当前用户的 `newemby://` 协议注册；Web 通过
固定回环地址读取版本、配对、PotPlayer 和 SMTC 分项状态。首次连接使用 Gateway
签发的 60 秒一次性配对码唤起 Bridge，浏览器在获得精确 Origin 授权前不得把
CORS 失败解释为确定的“程序未运行”。

### M3：体验完善

- 播放列表、人物页和收藏页。
- 多版本、音轨、字幕选择。
- 下一集队列。
- 移动端浏览适配。
- 性能、无障碍和错误恢复。

### M4：管理后台基础

- 管理概览、会话和用户。
- Bridge 设备管理。
- 活动日志。
- 管理员审计。

### M5：媒体与运维管理

- 媒体库路径、扫描和选项。
- 元数据、图片和刷新。
- 计划任务、设备、API Key 和日志。

### M6：完整设置与扩展

- 服务器配置和高风险系统操作。
- 插件管理。
- mpv、VLC 和其他播放器适配。
- 多服务器。
- Live TV、音乐和电视端按需求排期。

## 13. 发布与部署

### 13.1 服务端

首版部署拓扑固定为：

```text
Public Browser
  │ HTTPS
  ▼
Caddy / Nginx
  ├── /      ── NewEmby Web
  └── /api/* ── NewEmby Gateway ── HTTPS ── Public Emby API
                         │
                         └── /data/newemby.db

Player Bridge ── localhost only ── Browser
Player Bridge ── HTTPS ─────────── NewEmby Gateway
```

- Web、Gateway、反向代理和 SQLite volume 属于同一个 Docker Compose
  部署单元，可以与 Emby 分开部署。
- 现有 Emby 通过公网 HTTPS API 地址接入；Gateway 是唯一持有 Emby Token
  的 Web 服务，浏览器不直接访问 Emby API。
- 反向代理是唯一公网入口。Gateway 和 SQLite 不映射公网端口。
- Web 与 `/api/*` 使用同一公开 Origin，避免生产环境依赖跨域 Cookie。
- 每次数据库迁移前自动备份 SQLite 数据文件。

首版环境变量：

| 变量 | 用途 |
|---|---|
| `NEWEMBY_PUBLIC_ORIGIN` | NewEmby 的公开 HTTPS Origin |
| `EMBY_BASE_URL` | 当前且唯一的 Emby HTTPS API 地址 |
| `EMBY_ALLOWED_SERVER_ORIGINS` | 允许探测的 Emby Origin 精确列表 |
| `GATEWAY_HOST` | Gateway 监听地址，容器内默认 `0.0.0.0` |
| `GATEWAY_PORT` | Gateway 容器端口，默认 `3000` |
| `GATEWAY_TRUST_PROXY` | 可信反向代理跳数或网段 |
| `DATABASE_PATH` | SQLite 数据文件路径 |
| `SESSION_SECRET` | NewEmby 会话签名密钥 |
| `TOKEN_ENCRYPTION_KEY` | Emby Token 字段加密密钥 |
| `COOKIE_SECURE` | 生产环境固定为 `true` |
| `LOG_LEVEL` | 结构化日志级别 |
| `BRIDGE_ALLOWED_ORIGINS` | M2 Bridge 可接受的 NewEmby Origin |

所有密钥由部署环境生成，不写入镜像、Compose 文件或仓库。

### 13.2 公网访问与可信来源

- 首版支持公网访问，但只支持 HTTPS。HTTP 仅限本机开发环境。
- Caddy/Nginx 终止 TLS，生产环境启用 HSTS，并把 `/api/*` 转发给
  Gateway 的容器内地址。
- `NEWEMBY_PUBLIC_ORIGIN`、`EMBY_ALLOWED_SERVER_ORIGINS` 和
  `BRIDGE_ALLOWED_ORIGINS` 使用完整 Origin 精确匹配，不接受通配符。
- Web 与 Gateway 同源，生产环境不启用开放式 CORS。
- 会话 Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax` 和根路径。
- Gateway 只信任部署配置声明的代理跳数或网段，不信任任意
  `X-Forwarded-*` 请求头。
- Gateway 验证 Emby 的 TLS 证书，不提供跳过证书验证的生产选项。
- M1 起所有状态写操作同时校验 Origin 和 CSRF Token。

### 13.3 客户端 Bridge

- Windows 当前使用 self-contained single-file 便携版，用户将程序放在稳定目录
  后直接运行，不要求预装 .NET Runtime。
- 用户首次使用时显式注册当前用户级协议；移动或删除程序前先注销协议，移动后
  重新注册。Bridge 仅监听回环地址，不创建公网防火墙规则。
- 安装器、卸载器和自动更新延期；未来若加入，安装包和更新包必须校验签名。
- Bridge 与 Gateway 版本使用兼容范围，而非严格相等。

## 14. 风险清单

| 风险 | 影响 | 缓解方式 |
|---|---|---|
| 浏览器不能读取外部播放器状态 | 无法同步进度 | 必须使用 Bridge + IPC |
| Token 出现在播放器参数 | 凭据泄露 | 一次性票据和 Gateway 兑换 |
| PotPlayer SMTC 被关闭或时间线不更新 | 进度不准确 | 播放前检查、事件与轮询结合、明确阻止错误同步 |
| PotPlayer 多实例会话匹配错误 | 进度写入错误媒体 | `/title` 会话标识、进程生命周期和媒体属性三重匹配 |
| 不同播放器控制方式差异大 | 维护成本高 | `IPlayerAdapter` 隔离，逐个播放器建立独立验收 |
| Emby API 版本差异 | 页面或写操作失败 | Capability 探测和适配层 |
| 管理接口误操作 | 数据或服务中断 | 二次确认、差异预览、审计 |
| Bridge 被恶意网页调用 | 本机播放器被滥用 | Origin、配对密钥、nonce |
| 进度回传断网 | 续播不准确 | 本地事件队列和过期策略 |
| 海报过多导致首页卡顿 | 体验退化 | 尺寸化图片、虚拟化、预加载预算 |

## 15. 第一版成功指标

- 首页可交互时间在普通桌面网络下小于 2.5 秒。
- 媒体网格滚动不出现明显掉帧。
- 95% 的 PotPlayer 启动请求在 2 秒内进入播放启动状态。
- 95% 的 PotPlayer 会话在启动后 3 秒内完成 SMTC 匹配。
- 正常退出后的 Emby 进度误差不超过 15 秒。
- Bridge 离线和播放器缺失都有可执行的恢复说明。
- 普通用户无法调用任何管理员 Gateway 接口。
- 管理操作具有操作者、时间、目标和结果审计记录。

## 16. 开发前需要最终确认的产品决策

1. 已确认：Bridge 第一目标系统为 Windows。
2. 已确认：首版优先保证 PotPlayer 完整支持，mpv 作为第二适配器。
3. 已确认：Web 与 Gateway 同一部署单元，可与公网 Emby 分开部署。
4. 已确认：首版单服务器，数据模型预留多服务器字段。
5. 已确认：首版支持公网访问，强制 HTTPS 和精确可信 Origin。
6. 已确认：正式名称 NewEmby，应用 ID `NewEmby.PlayerBridge`，协议
   `newemby://`，主强调色 `#7C5CFF`，使用仓库自有 SVG Logo。

## 17. 官方参考

- Emby REST API：<https://dev.emby.media/doc/restapi/index.html>
- 用户认证：<https://dev.emby.media/doc/restapi/User-Authentication.html>
- 浏览媒体库：<https://dev.emby.media/doc/restapi/Browsing-the-Library.html>
- Playback Check-ins：
  <https://dev.emby.media/doc/restapi/Playback-Check-ins.html>
- Sessions：<https://dev.emby.media/reference/RestAPI/SessionsService.html>
- Library Structure：
  <https://dev.emby.media/reference/RestAPI/LibraryStructureService.html>
- Scheduled Tasks：
  <https://dev.emby.media/reference/RestAPI/ScheduledTaskService.html>
- System Service：
  <https://dev.emby.media/reference/RestAPI/SystemService.html>

- Windows 系统媒体会话时间线：
  <https://learn.microsoft.com/en-us/uwp/api/windows.media.control/globalsystemmediatransportcontrolssession.gettimelineproperties>
- Windows 系统媒体会话位置：
  <https://learn.microsoft.com/en-us/uwp/api/windows.media.control/globalsystemmediatransportcontrolssessiontimelineproperties.position>
- Windows 全局媒体会话管理器：
  <https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager>
