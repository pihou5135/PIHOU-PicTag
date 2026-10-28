# 迭代记录

按日期追加实做记录。同一天多轮时使用简短任务标题区分；不将上游历史记为新完成工作。当前状态见 [STATUS.md](STATUS.md)，执行约定见 [AGENTS.md](../AGENTS.md)，总览见 [README](../README.md)。

## 2026-10-26 · 建立本地持续维护项目

**目标：** 在用户主目录下建立 PIHOU-PicTag 的维护入口，便于不同 agent 接力，并保护已有代码和未提交内容。

**基线与分支：** 新副本 `~/PIHOU-PicTag`，`main` 跟踪 `origin/main`；起始与交付 HEAD 均为 `4d8b29189e9f2e8131f82d97c87c5820ead32ee7`。origin 为 `https://github.com/pihou5135/PIHOU-PicTag.git`。本轮没有新提交、功能改动或版本发布；维护文档留在工作区，未暂存。

**完成工作与涉及文件：**

- 浅查主目录及常见代码目录，确认实际 home（本机绝对路径保存在 PROJECT.local.md），目标目录原先不存在。
- 发现旧副本 `~/Documents/codex-fabu/PIHOU-PicTag`：同 origin、`main`、HEAD `aefde427b42065622b201cd55eb99b7dd4de0a57`。它有 `.gitignore` 修改和未跟踪的 `netlify.toml`；保留原位且未修改。
- 从公开仓库克隆独立的新副本。新 HEAD 比旧 HEAD 多两个已有提交；新副本没有迁入旧副本的本地 Netlify 配置。
- 更新 `README.md`：准确运行说明、源码布局、项目入口、讨论链接与验证边界；保留原 AI Studio 链接。
- 新增 `AGENTS.md`：开工核对、文件分工、交付记录、暂停接力和发布授权约定。
- 新增 `docs/STATUS.md` 与本文件：记录当前基线、未决事项、下一步及本轮事实。
- 使用已有 Node/npm 安装 package.json 声明依赖；没有调整系统、权限、凭据或依赖声明。

**验证：**

- 依赖安装成功：`npm install --ignore-scripts --package-lock=false --no-audit --no-fund --cache /tmp/pictag-maintenance-npm-cache`；安装 83 个包。仓库没有锁文件，本轮未新增。
- `npm run lint`：通过，退出码 0。
- `node --test tests/exportUtils.test.mjs`：7/7 通过；存在 Node `stripTypeScriptTypes` 实验特性提示。
- `npm run build`：通过，退出码 0；Vite 6.4.5；已有 `/index.css` 缺失警告未处理。
- 未执行真实浏览器功能验收、真实 ZIP 解压、线上部署核验、Netlify 操作、push 或 PR。交付复核通过：20 个相对文档链接有效，`git diff --check` 通过；新副本仅有 4 个预期维护文档的未暂存变化，remote、分支与 HEAD 符合上述基线；旧副本 HEAD、Git 状态和两份未提交文件的 SHA-256 校验值均未改变。

**决定与原因：**

- 新建独立副本，旧目录原样保留：避免搬动旧目录破坏依赖，也不把未提交配置隐式丢弃或迁入。
- 用 README、AGENTS、当前状态及单个按日期追加的记录承载维护：不引入重复项目树、空模板或单独的空决策库。
- GPT 讨论入口与 Codex 本地执行入口分工明确；以本地文件和实时 Git 为执行依据，不假设自动同步。
- 侧栏缺少注册接口且 UI 控制被拒绝，停止该操作；不通过内部配置或数据库绕过。

**未解决事项与接棒：**

- 旧 `.gitignore` 新增 `.netlify` 忽略规则；旧 `netlify.toml` 指定 `npm run build` 与 `dist`。两项改动尚未迁移或判定应舍弃，首次功能变更前先核对并记录决定。
- 目标网站、Netlify 仓库绑定与线上 commit 未核实；新副本不是已确认的完整生产基线。
- 历史 WebP 扩展名/ZIP 重名只作为待复核线索。克隆 HEAD 已含相关代码和测试，本轮没有重新修复或宣称线上验收。
- 侧栏项目未注册；由用户正常添加 `~/PIHOU-PicTag` 并将任务归入。具体步骤见 [当前状态](STATUS.md)。
- 下一位 agent 先读取当前状态和 Git，再确定首个获准功能任务及验收标准。


## 2026-10-26 · 缩放/拖动边界未覆盖提醒（待用户验收）

**目标：** 图片没有完全覆盖实际导出裁切区时实时提示，单图与批量 ZIP 导出前可返回调整或明确继续；不强制裁切，不把提示画进图片。

**配置前置核对：** 旧副本 `.gitignore` 仅新增 `.netlify` 忽略，`netlify.toml` 仅指定 `npm run build` / `dist`。与本地 Vite 开发和测试无冲突，决定本轮不迁移部署配置，旧目录及未提交改动保持原样。新 `.gitignore` 本轮仅增加测试产物 `/output/playwright/` 的忽略规则。

**分支与提交：** 从 `main` / `4d8b29189e9f2e8131f82d97c87c5820ead32ee7` 开始，保留上轮维护文档；交付分支 `codex/image-boundary-warning`，功能提交 `af75a1a412812b3334f9b34c59f760eb2254152a`。维护文档与截图另存本地提交，具体 HEAD 以 Git 为准；未 push、PR、合并或部署，没有增加产品版本号。

**实际变更与分工：**

- `services/coverage.ts`、`services/canvasUtils.ts`：geometry agent 提供共用画布/源图矩形，统一实际导出、预览与边界判断，保留格式/水印/压缩；浮点容差仅忽略舍入误差。
- `components/ImageCard.tsx`、`components/CoverageDialog.tsx`：UI agent 实现橙色露边、中文方向说明、ResizeObserver 拖动坐标换算、复位、导出确认/取消与可访问键盘操作。
- `App.tsx`、`services/exportChecks.ts`、`services/exportUtils.ts`、`components/SettingsPanel.tsx`：协调 agent 统一单图/ZIP 导出检查、确认消费与防重复下载，设置变化清除旧处理结果；修正 setter 类型以匹配函数式更新。
- `tests/coverage.test.mjs`、`tests/exportChecks.test.mjs`、`tests/exportUtils.test.mjs`：25 项回归，原来的源码字符串提取改为实际导出条目与真实 ZIP 解压校验。
- `tests/browser-boundary.cjs`：可复跑的独立浏览器验证，使用已有 Playwright/Chrome，不自动安装依赖；生成物在 `output/playwright/`。
- `README.md`、`AGENTS.md`、`docs/STATUS.md`、本记录与 `docs/verification/2026-10-26-boundary/`：更新使用、接力、用户验收与发布边界，保存真实截图和结果。

**实际验证：** `node --test tests/*.test.mjs` 25/25；`npm run lint` 与 `npm run build` 退出码 0；构建已有 `/index.css` 警告不在本轮修复。Chrome/Playwright 在 DPR 2、1500×1000 和 1280×900 下通过 10 组交互场景，实际下载并检查 5 份 PNG/JPEG/ZIP；取消不下载，双重确认仅一次，修正后不弹窗，ZIP 中图像字节与单图一致，像素检查与绘图逻辑验证未包含告警辅助层。完成截图目视检查。具体场景与截图见 [当前状态](STATUS.md#首轮功能与验证)。未运行 Safari/Firefox、触屏、极大图或线上验收；未宣称用户验收通过。

**授权与决定：** 用户先要求本地测试，随后明确允许 GitHub 同步但禁止部署，并确认暂按“本地测试 → 安全同步功能分支 → 用户验收 → 另行确认合并部署”流程。为本次验收保留 `127.0.0.1:4173` 服务，不开放公网。GitHub workflows 查询 404、Actions runs 为 0，但无 Netlify 云端读取能力，不能证明分支推送不触发部署，故不 push/PR、不改云端配置。`[skip netlify]` 是额外保护，未用于替代核查。不是永久自动同步/发布授权。

**未完成与接棒：** 等用户在 [本机地址](http://127.0.0.1:4173/) 测试；取得 Netlify 绑定、生产分支和所有自动部署触发的可核验证据后才考虑同步独立分支，作者身份也需在公开同步前核对。既有异步补传与批量处理并发可能丢失新列表的问题已由只读审阅发现，属于旧问题，未擅自扩展修复。旧目录保护、原 CSS 警告、侧栏手动添加和线上基线未知继续保留。接手前重新核对 Git 与服务状态。


## 2026-10-26 · 用户验收通过，同步并正式发布

**授权与目标：** 用户明确回复“我测试了挺好的，接下来就是直接同步部署到服务器”，覆盖此前本轮暂停部署限制；本项目的服务器指既有 Netlify 正式站点，不新建站点。父级随后确认相同授权。

**实际操作：** 核实 GitHub 账号与 origin，fetch 后 main 仍为 `4d8b291`，无冲突。将本轮未公开提交改用与上游一致的 GitHub noreply 身份，未改全局配置；功能提交为 `af75a1a412812b3334f9b34c59f760eb2254152a`。私有讨论 URL 和本机绝对路径移入被忽略的 `PROJECT.local.md`，公开文档使用 home 相对路径。维护说明、截图与测试证据保存为 `19df7420b9f5799bcab8e5de0ca90dd448f81e64`。旧副本 HEAD、状态及两份未提交文件哈希仍不变。

通过已登录的官方 Netlify CLI 核实既有 `pihou-pictag` 站点（ID `2f09f9aa-d230-4ee3-b7bc-3aa1689350f7`）绑定 `pihou5135/PIHOU-PicTag` 的 `main`，构建命令 `npm run build`、输出 `dist`、自动构建开启。原 CLI 缓存缺依赖，改用临时缓存运行同版本 24.5.1；未安装全局软件、读取凭据文件或修改站点设置。

**同步/部署结果：** 正常快进推送 `main` 从 `4d8b291` 到 `19df742`，没有强推或 PR；GitHub API 已确认远端 commit。Netlify 自动触发正式部署 `6adf28f54668e79652ae7e4c`，于 **10:18:49 UTC** 发布为 `ready`；站点 published_deploy 指向相同 commit。没有手动重复部署。本地 main 也快进到此版本，功能分支保留。

**线上验证：** 以 `PICTAG_TEST_URL=https://pihou-pictag.netlify.app` 运行 `tests/browser-boundary.cjs`（使用已有 Playwright/Chrome），10 组场景通过、5 次真实下载通过，无页面脚本异常；再次检查边缘/几何、取消/继续、一次性确认、修正后正常输出和 PNG/JPEG/ZIP 未包含提示层。证据在 [生产结果](verification/2026-10-26-boundary/production-results.json) 与 [截图](verification/2026-10-26-boundary/production-confirmation.png)。本轮已运行的 25 项单测、类型检查与构建结果保持有效，后续仅改文档/证据。

**回滚点与收尾：** 上一部署 `6ad98564ac3b74535fd9623c` / commit `4d8b29189e9f2e8131f82d97c87c5820ead32ee7` 已记录；本轮不执行回滚。更新 README、AGENTS、STATUS、本记录及生产证据，使用 `[skip netlify]` 的纯记录提交同步，避免再次构建相同代码。用户验收完成后停止临时 `127.0.0.1:4173` 服务，正式网址继续可用。没有新增功能范围、版本号、凭据、付费或站点设置变更。

**未解决：** Safari/Firefox/触屏/极大图未测；旧异步补传并发问题和 CSS 缺失警告未修；侧栏项目仍待用户手动添加。未来新功能和发布继续逐轮授权，不能把本次验收等同永久自动部署许可。


## 2026-10-27 · 第二轮：文字与图片水印实时预览（待用户验收）

**目标与范围：** 添加、输入、替换或调整水印后实时预览，文字与图片均支持；沿用现有全局水印与单图裁切/缩放状态，不新增字体或单图水印模式。上一轮发布授权不延用，本轮只交付本地验收版本。

**基线与提交：** 开工确认 origin 为指定仓库，`main` / `cdba1d1fbb584e20ba8a3e426820cd585a9f0878`，工作区干净。创建 `codex/live-watermark-preview`；本地功能提交 `65e81f6f1195c81271fd748309a140e32dde1092`，验证证据和维护记录另作本地提交。没有 push、PR、合并main或Netlify部署。旧副本HEAD/未提交状态/两项配置哈希复核保持原样。

**变更、文件与分工：**

- `services/canvasUtils.ts`：renderer agent 抽出 `renderCompositionToCanvas`，预览与全尺寸导出共用实际坐标/文字/阴影/图片水印；资源完成且请求仍有效才绘制。缓存限4个水印和32个字体请求，失败可重试；水印加载失败明确报错，避免默默缺水印。
- `components/LivePreview.tsx`、`components/ImageCard.tsx`：协调 agent 接入有界缩略Canvas，按帧合并更新，离屏延后绘制，旧请求作废；保留第一轮DOM边界告警。JPEG黑底与PNG透明显示保持编码语义。
- `components/SettingsPanel.tsx`：settings agent 完成首次选择/直接替换/移除、FileReader与图片解码竞态保护、加载/失败反馈、现有控件标签；不新增文字opacity/usePrefix控件，既有预设值可实时显示。
- `App.tsx`：新水印读取期间阻止应用/单图/ZIP导出，避免旧下载与新选择竞争；其余编辑、替换与移除保持可用。
- `tests/rendering.test.mjs`、`tests/settingsUpload.test.mjs`：新增32项实际绘制/资源/竞态单测；`tests/coverage.test.mjs`仅适配共享绘制mock，`tests/browser-boundary.cjs`仅适配文字控件可访问名称。
- `tests/browser-watermark.cjs`：QA agent 提供真实浏览器场景、延迟字体/读取竞态、导出对比和批量成本验证；截图/结果保存在 `docs/verification/2026-10-27-watermark/`。README、AGENTS、STATUS和本记录更新本轮授权与交接。

**验证实际结果：** 57/57单测通过，类型检查与构建退出码0。水印浏览器7组通过、4次下载；透明区域格式专项1组通过、2次下载；上一轮边界浏览器10组通过、5次下载。涵盖现有文字样式、预设透明度/前缀、图片所有位置/比例/透明度、首次/替换/删除、快速输入/切图、独立裁切与复位、生成下载结果前后的预览、PNG/JPEG/ZIP对齐。Chrome页面无脚本异常，截图已目视复核。

编辑过程 `toDataURL=0`；36张4096×3072合成图中16张初始不绘制，最大预览398px，滚入时绘制最新设置。PNG/JPEG与预览降采样平均通道差0.101/0.586。格式专项最初“原始像素hash完全相等”的断言发现0.090均值微差；固定同源/同设置重复绘制复现相同差异，水印bbox/count完全一致，改用实际几何、透明度和明确像素容差验证，不声称逐字节相同。具体数值、截图和命令见 [当前状态](STATUS.md#第二轮验证)。

**决定：** 共用Canvas而非重新猜CSS水印坐标；预览不编码原图、正式结果仍由明确“应用”生成；只绘制可见/附近卡片，资源缓存有界；水印文件留在浏览器本地。选择新水印期间仅阻止生成/下载，不锁死正常编辑。保留现有功能边界，不修其他旧问题。

**同步核查与未完成项：** 已只读确认Netlify仅允许main、无build hooks，仓库无workflow/runs、目标分支无开放PR，唯一仓库hook匹配既有Netlify站点；其他App/组织级集成未全面核实。因此保留本地，不push/PR、不改站点设置绕过。等待用户本轮验收及后续明确发布授权。Safari/Firefox/触屏与更多字体硬件未测；旧并发问题和CSS缺失警告保留。服务 [127.0.0.1:4173](http://127.0.0.1:4173/) 按授权暂时运行，只监听loopback；停止/重启方式见STATUS。


## 2026-10-27 · 恢复第二轮本地验收入口

**目标与基线：** 用户报告本机地址无法连接。核实 `codex/live-watermark-preview` / `4f507166c812cf58f318a677ff2512daa2684e07`，开工工作区干净、origin 正确。4173 无监听，curl 连接失败，旧 Vite 进程不在；确切退出原因未确认，执行器重连不等于服务恢复。

**实际操作与文件：** 新增根目录 `启动本地预览.command`，在独立 Terminal 窗口前台运行已有 Vite，明确绑定 `127.0.0.1:4173` / strictPort。脚本定位自身目录并使用现有 Node/npm，端口占用只提示退出，不杀进程、不自动安装依赖；没有后台登录启动项或系统网络设置变更。更新 README、STATUS、本记录及恢复截图/结果。没有修改应用功能代码、旧副本或远端；这些恢复文件暂未提交。

**实际验证：** `/bin/zsh -n` 语法通过；监听进程确认来自本项目 Vite，HTTP 200。2026-10-27 03:53 UTC 真实 Chrome 隔离会话使用合成图完成文字编辑、选择图片水印，均在“应用”前改变预览 Canvas，无页面脚本异常；截图与 JSON 保存于 `docs/verification/2026-10-27-watermark/recovery*`。本次没有重跑57项功能单测/全量构建或导出回归，应用源码未变；上一轮验证记录保留。

**交付与下一步：** [本机验收地址](http://127.0.0.1:4173/) 已恢复；保持终端窗口运行，Ctrl+C 停止，之后可双击启动器恢复。Mac休眠/重启或关闭终端可能影响可用性，接手先查实际监听和HTTP。继续等待用户第二轮验收；没有GitHub推送、PR、合并main或Netlify部署，本轮无发布授权。


## 2026-10-27 · 本地服务再次排障，暂停 GitHub 同步

**用户目标及授权：** 本地无法访问后询问GitHub预览。用户选择“仅同步GitHub，暂不部署预览”，核查过程中又明确“先保留本地，暂不继续同步”。最终按后者暂停远端写入，没有push、PR、合并main、在线预览或生产部署。

**本地排障与操作：** 用户确认使用同一Mac的Safari/Chrome。实际4173无监听、curl连接失败；上次独立Terminal服务已退出，确切原因未确认。用已有Node/Vite启动独立会话进程，标准输入关闭、输出重定向到 `/tmp/pictag-preview-4173.log`，PID记录 `/tmp/pictag-preview-4173.pid`，没有登录启动项或系统网络设置修改。应用源码未变；分支仍 `codex/live-watermark-preview` / `4f50716`。改动仅为前次启动器/文档/证据和本次状态、迭代、运行检查记录，暂未提交。

**验证与限制：** 2026-10-27T12:04:30+08:00（北京时间）核实进程来自本项目、HTTP 200，内置浏览器可加载并刷新且显示实时水印控件。没有重跑已有57项功能测试或构建；本次仅恢复运行。未控制用户Safari/Chrome，未确认用户本次验收成功，跨重启/执行器断连的持久性未验证。读取Terminal界面被计算机使用工具安全限制拒绝，未重试/绕过；CLI进程与HTTP检查仍正常。

**远端只读结果：** GitHub main `cdba1d1`，目标功能分支尚不存在；Actions workflows/runs为0、目标PR为0，唯一活跃repo webhook主机为api.netlify.com。Netlify绑定不变、allowed_branches仅main，线上部署仍 `6adf28f54668e79652ae7e4c` / `19df742`。GitHub App完整清单的两个API受现有权限限制，网页未登录；未扩大权限，未把skip标记当作完整核查。用户已暂停同步，后续须按新指令继续。


## 2026-10-27 · 第三轮：图片水印位置微调（本地完成，待用户验收）

**目标和授权：** 用户确认实时预览正常，要求图片水印能进一步调整位置，解决与文字水印同时使用时的遮挡。沿用最新“先保留本地，暂不继续同步”，没有GitHub写入、PR或Netlify部署；第二轮验收不构成本轮发布授权。

**基线与范围：** 分支 `codex/live-watermark-preview`，起始/当前已提交HEAD `4f507166c812cf58f318a677ff2512daa2684e07`。已有未提交服务恢复说明、启动器和证据全部保留。本轮功能、测试与文档仍为未提交本地改动；旧副本HEAD/状态/`.gitignore`及`netlify.toml`哈希复核未变。

**实际文件和决定：** geometry agent在 `types.ts`、`constants.ts` 新增 watermarkOffsetX/Y，默认0；`services/canvasUtils.ts`在五个既有定位计算之后追加最终输出像素偏移，缺省/非有限值归0，预览导出共用。settings agent在 `components/SettingsPanel.tsx`添加两轴输入及复位，支持负数、小数、键盘调整；保留输入草稿避免`-0.5`中负号被自身更新清除，空值失焦归0。旧预设不继承上次偏移，新预设保存/还原，替换/移除/切定位保留偏移。保持文字、原共享边距、源图拖动与裁切，不引入第二种拖拽模式或自动避让，不修其他旧问题。

测试新增在 `tests/rendering.test.mjs`（10项）、`tests/settingsUpload.test.mjs`（8项），QA新增 `tests/browser-watermark-position.cjs`。协调agent集成、审阅并更新README/STATUS/本记录及 `docs/verification/2026-10-27-watermark-position/`。原App的设置更新路径已使旧结果失效，无需改App/LivePreview。

**验证实际结果：** `node --test tests/*.test.mjs`75/75；`npm run lint`与`npm run build`均退出码0，原`/index.css`警告保留。已有Playwright/Chrome运行位置脚本7组、3次PNG/JPEG/ZIP下载通过，源图边界脚本10组、5次下载通过；页面无脚本异常，合成素材未上传外部服务。覆盖五anchor、正负小数、逐键`-80.5`/`-40.25`/`-0.5`、清空失焦、文字不动/重叠移开、复位、旧新及新保存预设、快速输入、替换删除重选、宽竖/resize/crop、旧下载失效和告警不导出。PNG/JPEG预览对导出均值通道差0.4075/0.3496；ZIP内PNG与单张字节一致，编辑编码0次。截图已目视复核；详细命令/代码哈希/证据见STATUS。

**交付与未完成：** 本地原4173独立服务保持运行，没有重启用户正在用的服务，热更新加载修改；当前入口 `http://127.0.0.1:4173/`。用户可在图片水印区使用水平/垂直偏移，负垂直值将水印上移，与文字错开。第三轮尚待用户验收；Safari/Firefox/触屏未测，后台服务跨重启/断连持久性未保证。无需继续远端核查，恢复同步/发布须按未来新授权。


## 2026-10-27 · 第三轮反馈：上下左右按方向操作

**目标：** 用户要求“上下移动就上下，左右就左右”，把图片水印正负偏移输入改为直观方向操作。沿用仅本地授权，分支/HEAD仍为 `codex/live-watermark-preview` / `4f50716`，未提交的前轮功能和维护文件全部保留。

**变更：** `components/SettingsPanel.tsx`以三乘三方向盘替换两轴数字输入，上-Y/下+Y/左-X/右+X，中央复位；步长select为1/10/50像素、默认10。删除原数字草稿同步代码，使用函数式更新避免连点丢步。方向盘内四Arrow键与按钮一致，Enter/Space保留原生点击；select位于方向键group外，改变步长不移动图片。忙碌/图片禁用时保持禁用，旧新预设兼容不变，步长不入预设。没有改Canvas、裁切、导出或其他功能。

控件agent适配 `tests/settingsUpload.test.mjs`，QA更新 `tests/browser-watermark-position.cjs`，协调agent更新README/STATUS/本记录并保存 `docs/verification/2026-10-27-watermark-directions/`；只读reviewer核对方向、更新顺序与禁用。所有分工完成。

**验证：** 全量Node单测82/82，类型检查与构建退出码0，原`/index.css`警告保留。方向盘浏览器8组、3次真实PNG/JPEG/ZIP下载通过；四按钮、每轴方向/步长/连点/文字不动、四Arrow键及Enter/Space、复位/预设/换图、宽竖裁切缩放、旧结果失效及告警不导出均覆盖。PNG/JPEG预览对导出平均通道差0.3073/0.3444，ZIP PNG与单张字节一致，编辑编码0次，无页面脚本异常，截图已目视检查。

**限制与交付：** headless Chrome原生select键盘选项不改变的现象独立复现，未宣称原生菜单键盘选值通过；实测其方向键不误移动图片，实际步长change用selectOption验证。未测Safari/Firefox/触屏；未重复跑完整边界浏览器套件，Canvas未改且前版10组回归记录保留。当前功能和记录均未提交；没有GitHub同步/PR/Netlify部署。本地4173服务保持，方向盘版待用户验收。


## 2026-10-28 · 最新水印功能正式发布准备

- **目标/授权**：用户明确说“pictag可以更新到最新了，同步github和部署”，解除此前同步暂停，批准现有Netlify正式站发布。本次包含第二轮文字/图片水印实时预览与第三轮图片水印方向移动，不构成以后自动发布授权。
- **范围**：接手 `codex/live-watermark-preview` / `4f507166c812cf58f318a677ff2512daa2684e07`，保留并提交上一轮方向控件、偏移类型/默认值/共用Canvas、相关单测/浏览器脚本、合成验证证据、启动器及维护说明。本轮未追加功能代码；更新 README、STATUS、ITERATIONS 和本日发布验证记录。
- **前置核对**：origin为 `pihou5135/PIHOU-PicTag`，fetch后main仍 `cdba1d1fbb584e20ba8a3e426820cd585a9f0878`，无新增远端冲突。Netlify站点 `2f09f9aa-d230-4ee3-b7bc-3aa1689350f7` / `pihou-pictag` 正式绑定该仓库main；构建/输出 `npm run build` / `dist`，自动构建开启。旧副本配置未迁入，HEAD、状态与哈希完全保持。私有 PROJECT.local.md 被忽略，未纳入同步。
- **实际验证**：`node --test tests/*.test.mjs` 82/82；`npm run lint`、`npm run build`退出0；方向Chrome浏览器8组/3次PNG/JPEG/ZIP下载、边界Chrome浏览器10组/5次下载均通过，无页面异常。方向截图目视通过，启动器 `zsh -n`、`git diff --check`通过。仅原 `/index.css` 构建警告；未重跑Safari/Firefox/触屏和原生select键盘选值。
- **证据**：[发布前汇总](verification/2026-10-28-watermark-release/preflight.json)、[方向回归](verification/2026-10-28-watermark-release/local-directions-results.json)、[边界回归](verification/2026-10-28-watermark-release/local-boundary-results.json)。release_review只读审查未见阻断问题，release_validation完成检查；所有写操作和发布由协调agent统一负责。
- **当前阶段/下一步**：本条记录提交时尚未推送或完成本次部署。将快进合入main并一次推送，通过既有Git集成触发部署，不新建站点、不改设置或权限、不手动重复部署。随后核对实际commit、ready/published部署和生产浏览器功能，并补充最终证据。回滚基线为部署 `6adf28f54668e79652ae7e4c` / 功能commit `19df7420b9f5799bcab8e5de0ca90dd448f81e64`。
