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
