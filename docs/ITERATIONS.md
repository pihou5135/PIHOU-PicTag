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
