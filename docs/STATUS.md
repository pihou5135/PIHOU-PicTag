# 当前状态与下一步

最后更新：2026-10-27（UTC）。入口：[README](../README.md) · [接力约定](../AGENTS.md) · [迭代记录](ITERATIONS.md)

## 当前结论

**第二轮文字/图片水印实时预览已完成本地实现和验证，待用户验收，尚未推送或上线。** 当前分支 `codex/live-watermark-preview`；起始 HEAD `cdba1d1fbb584e20ba8a3e426820cd585a9f0878`，开工时工作区干净；功能提交 `65e81f6f1195c81271fd748309a140e32dde1092`，验证/维护记录另作本地提交（实时 HEAD 以 Git 为准）。本轮没有改动旧副本或远端。

本机验收地址：**[http://127.0.0.1:4173/](http://127.0.0.1:4173/)**。Vite 服务暂时保留，仅监听 `127.0.0.1:4173`。启动命令 `cd ~/PIHOU-PicTag && npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`；停止可让本任务执行，或在对应终端按 Ctrl+C。若本执行会话结束导致服务停止，用同一命令重启。

### 第二轮实际行为

- 上传目标图后，输入/调整文字，选择/替换图片水印时，卡片立即展示当前效果，无需先点击“应用到所有图片”。文字/图片可同时开启；原有全局水印设置作用到所有图片，各图裁切、缩放、拖动独立。
- 文字内容、字号、颜色、粗细、边距和预设中的既有 opacity/usePrefix 均实时更新；图片水印的大小、五种位置、透明度、首次选择/替换/移除均覆盖。未新增字体或单图水印设置。
- 预览与导出共用 `renderCompositionToCanvas`；像素尺寸可缩小，实际输出坐标、文字比例、阴影和图片水印布局一致。PNG 透明区域保持透明，JPEG 显示与编码一致的黑色底色；有轻微浏览器光栅/重采样差异，不承诺逐字节相同。
- 可见/附近卡片按动画帧合并绘制，位图上限 1024px，离屏卡片延后更新；共享有限字体/已解码水印缓存。编辑预览不调用图片编码；“应用到所有图片”才生成下载结果，之后编辑会清除旧结果。
- 旧异步绘制不能写回新状态。新图片读取+解码成功才替换，失败明确提示并保留原水印；读取中阻止应用/单图/ZIP导出，继续允许编辑、替换和移除。
- 第一轮边界提醒、返回调整/继续导出、提示不进入导出图片的行为保持。

### 第二轮验证

| 检查 | 实际结果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 57/57 通过：原25项、共享渲染23项、图片选择竞态9项 |
| `npm run lint`、`npm run build` | 均通过，退出码0；原 `/index.css` 构建警告保留 |
| `tests/browser-watermark.cjs` | Chrome/DPR2 下7组场景通过、4次实际 PNG/JPEG/ZIP 下载；无页面脚本异常 |
| `PICTAG_WATERMARK_FOCUS=format` 专项 | 1组通过、2次实际下载；JPEG角落黑色不透明，PNG角落alpha为0，文字与图片水印位置一致 |
| `tests/browser-boundary.cjs` | 第一轮10组回归通过、5次下载验证，无边界提醒回归 |
| 成本/批量 | 编辑阶段 `toDataURL` 调用为0；36张4096×3072合成图中初始16张未绘制，最大预览位图398px，滚入时使用最新设置 |

[水印测试结果](verification/2026-10-27-watermark/results.json) · [格式专项](verification/2026-10-27-watermark/format-results.json) · [边界回归](verification/2026-10-27-watermark/boundary-regression-results.json)

截图：[应用前实时预览](verification/2026-10-27-watermark/01-live-before-apply.png)、[裁切与水印](verification/2026-10-27-watermark/02-live-crop-and-watermark.png)、[批量可见卡片](verification/2026-10-27-watermark/04-visible-batch.png)、[JPEG底色](verification/2026-10-27-watermark/05-jpeg-black-preview.png)、[PNG透明区域](verification/2026-10-27-watermark/06-png-transparent-preview.png)。使用非私密合成素材，图片未上传外部服务。PNG/JPEG 对预览降采样比较的平均通道差为0.101/0.586；格式切换专项出现0.090的微差，相同输入重复绘制也复现，水印位置/bbox完全一致。

未运行 Safari/Firefox、触屏设备或穷尽不同硬件字体渲染；未部署本轮代码。旧补传图片与批处理并发问题、原CSS警告仍不扩展修复。文字 opacity/usePrefix 原来仅预设支持，本轮没有增设新控件。

### 第二轮验收与接力

1. 打开本机地址并上传一至多张图，在“文字”输入内容并调整字号/颜色/粗细/边距，确认不用应用即可看到变化。
2. 在“图片”选择或替换水印，调整大小/位置/透明度；尝试两种水印同时开启、移除、快速连续输入、裁切/缩放/复位。
3. 点击“应用到所有图片”生成下载结果，再比较单图和 ZIP；修改后需重新应用。露边时仍可返回调整或明确继续。

本轮分工已完成，无进行中文件占用：协调 agent 负责 LivePreview/卡片/App集成与记录；renderer agent 负责共用Canvas和单测；settings agent 负责图片读取竞态与控件；QA agent 负责浏览器验证。接手先读实时Git和最新用户反馈，不把本轮自动检查当成用户验收。

本轮同步规则：只读核查发现 Netlify `allowed_branches=["main"]`、该独立分支不在允许列表、build hooks为0；GitHub workflows目录404、Actions runs为0、该分支无开放PR，唯一启用仓库hook匹配既有Netlify站点。没有修改配置。其他GitHub App/组织级集成未全面核实，因此本轮保持本地，不以PR试探，也未推main或部署。后续如用户明确批准本轮发布，再按当时授权核实目标并执行；上一轮许可不延用。

旧 `.gitignore` / `netlify.toml` 的既有差异不影响本地开发；旧副本HEAD、Git状态和两份未提交配置哈希复核未变。私有讨论入口仍在被忽略的 `PROJECT.local.md`。

## 第一轮结束时的仓库基线（历史）

| 项目 | 新维护副本 | 旧副本（保留原样） |
| --- | --- | --- |
| 目录 | `~/PIHOU-PicTag` | `~/Documents/codex-fabu/PIHOU-PicTag` |
| origin（fetch / push） | `https://github.com/pihou5135/PIHOU-PicTag.git` | 同左 |
| 分支 | `main`，跟踪 `origin/main`；本地功能分支保留 | `main`，跟踪旧的本地 `origin/main` |
| 功能基线 | 起始 `4d8b291`；本轮功能提交 `af75a1a412812b3334f9b34c59f760eb2254152a`；当前 HEAD 以 `git rev-parse HEAD` 为准（接力文档另提交） | `aefde427b42065622b201cd55eb99b7dd4de0a57` |
| 本地交付 | 功能、维护文档与验证证据已推送；收尾记录提交不改变线上代码 | `.gitignore` 已修改；`netlify.toml` 未跟踪 |

初始化时克隆 HEAD 比旧 HEAD 多 2 个已有提交，涉及图片大小限制/压缩与导出命名；两提交共涉及 9 个文件（247 行增加、25 行删除）。这是克隆得到的上游历史，不是本次实现。旧副本未执行 fetch/pull，其远程跟踪引用不代表现在的 GitHub 状态。

旧副本未提交差异的非敏感摘要：

- `.gitignore` 比其 HEAD 多了 `# Local Netlify folder` 及 `.netlify` 忽略规则。
- 未跟踪的 `netlify.toml` 设置 `[build]`：`command = "npm run build"`、`publish = "dist"`。
- 新副本中没有这两项 Netlify 本地配置变化。本轮 `.gitignore` 仅额外忽略 `/output/playwright/` 生成的浏览器测试产物，未迁入旧 `.netlify` 规则。本次未读取 `.netlify` 内部状态或凭据，不能从上述文件确认网站绑定。

## 初始化验证（历史基线）

本地环境：Node.js `v24.13.0`、npm `11.6.2`。新副本原始工作区干净；未找到原有 AGENTS 或 `.agents/skills` 约定。

| 检查 | 实际结果 |
| --- | --- |
| 声明依赖安装 | 成功；`npm install --ignore-scripts --package-lock=false --no-audit --no-fund --cache /tmp/pictag-maintenance-npm-cache`，83 个包；未更改 package.json 或新增锁文件 |
| `npm run lint` | 通过，退出码 0；实际为 TypeScript 检查 |
| `node --test tests/exportUtils.test.mjs` | 7/7 通过；Node 提示 `stripTypeScriptTypes` 为实验特性 |
| `npm run build` | 通过，退出码 0；本地解析到 Vite 6.4.5，生成 `dist/` |
| 交付复核 | 20 个相对文档链接有效，`git diff --check` 通过；只有 4 个预期维护文档发生变化，均未暂存；旧副本 HEAD、Git 状态与两份未提交文件的 SHA-256 校验值均未改变 |

构建已有警告：`/index.css` 在构建时不存在，保留到运行时解析。本次未修改此问题。`node_modules/`、`dist/` 由既有规则忽略。

初始化时未执行：真实浏览器上传/Canvas 编码、真实 ZIP 下载解压、功能验收、线上与 commit 对照、Netlify 绑定检查、部署（本轮后续已补做，见下）。测试包含下载和 ZIP 的替身，只证明已覆盖的逻辑，不能替代这些验证。

## 首轮功能与验证

- 裁切模式下共用源图/导出几何：预览、Canvas、导出检查使用相同坐标与整数输出尺寸；浮点舍入不误报，实际露边会提醒。
- 橙色露边区域、中文方向提示；修正即解除，透明/白色源图内容不作为露边判断。
- 单图和 ZIP 统一导出确认，可返回调整、Esc 取消或仍然导出；确认消费一次。修改设置使旧结果失效，防止检查与实际下载内容不一致。
- 保留原有格式、压缩与水印行为；提醒是 DOM 层，不画入 Canvas。宽竖输出的预览比例、响应式尺寸变化与拖动换算已核对。

| 检查 | 本轮实际结果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 25/25 通过：几何 16、导出检查 2、原有命名/真实 ZIP 回归 7 |
| `npm run lint` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；原有 `/index.css` 警告保留 |
| Chrome + Playwright | 10 组场景通过，DPR 2，1500×1000 与 1280×900；无页面脚本异常 |
| 实际下载 | 5 次：PNG、混合 ZIP、JPEG、修正后 JPEG 与 ZIP；取消无下载，重复确认只下载一次；PNG 透明空隙/JPEG 背景与源图像素抽查通过，ZIP 条目与 PNG 字节一致 |

浏览器场景覆盖默认/恰好铺满、缩小、四向真实拖动、放大后的覆盖余量、拖回立即解除、宽竖源图和输出、响应式布局、复位/换图/裁切开关、透明与白图、混合批量、取消/继续/修正后导出。结果：[机器记录](verification/2026-10-26-boundary/results.json)；截图：[铺满](verification/2026-10-26-boundary/01-covered.png)、[露边提示](verification/2026-10-26-boundary/02-uncovered.png)、[导出确认](verification/2026-10-26-boundary/03-export-confirmation.png)。

测试使用非私密合成图；未测 Safari/Firefox、触屏设备、极大文件或生产环境。独立代码复核另发现基线已有的“补传图片异步解码与批量处理同时发生可能覆盖新列表”问题；未在本轮扩展修复，建议后续单独确认任务，验收时先等上传完成再应用。原 `/index.css` 问题未处理；本轮 Netlify 线上匹配已在发布阶段核实。历史 WebP/ZIP 命名修复不计为本轮新增修复。

## 第一轮用户验收与本地服务（历史）

**用户已明确回复“我测试了挺好的”，本轮用户验收通过。** 正式地址：[https://pihou-pictag.netlify.app/](https://pihou-pictag.netlify.app/)。本机验收曾使用 `127.0.0.1:4173`；正式站点验证完成后已停止临时 Vite 服务，从未开放公网。

1. 上传图片，开启“统一裁切尺寸”；设置导出尺寸后缩小/拖动，检查橙色露边和方向提醒。
2. 点击“应用到所有图片”，分别试单图与 ZIP 下载；验证“返回调整”不下载，“仍然导出”保留有意留白。
3. 调整回铺满后重新应用，确认下载不再弹窗。也可点卡片“复位”恢复原始缩放及居中位置。

启动命令：`cd ~/PIHOU-PicTag && npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`。当前临时服务已停止。需要本地继续开发时用上述命令启动，在该终端按 Ctrl+C 停止；要手工定位时先用 `lsof -nP -iTCP:4173 -sTCP:LISTEN` 核对确为该项目的 Vite 进程，再停止该进程，不使用广泛杀进程命令。

## 第一轮正式发布证据与回滚点（历史）

- GitHub 仓库：`pihou5135/PIHOU-PicTag`；发布时远端 `main` 已核实为 `19df7420b9f5799bcab8e5de0ca90dd448f81e64`，由功能提交 `af75a1a` 和维护记录提交 `19df742` 组成。未强推、未创建 PR。
- Netlify 站点：`pihou-pictag`，site ID `2f09f9aa-d230-4ee3-b7bc-3aa1689350f7`；GitHub 绑定指向上述仓库 `main`；构建 `npm run build`，输出 `dist`，自动构建启用。仅使用现有站点和现有登录，没有修改站点设置。
- 正式部署：[6adf28f54668e79652ae7e4c](https://app.netlify.com/projects/pihou-pictag/deploys/6adf28f54668e79652ae7e4c)，`ready`，`production`，发布时间 **2026-10-26 10:18:49 UTC**；Netlify `published_deploy.commit_ref` 与 `19df742` 一致。由 GitHub main 推送自动触发，没有重复手动部署。
- 正式域名上再次完成同一套 10 组 Chrome 浏览器场景、5 次实际 PNG/JPEG/ZIP 下载检查；无页面脚本异常。证据：[生产验证 JSON](verification/2026-10-26-boundary/production-results.json)、[正式站点导出确认截图](verification/2026-10-26-boundary/production-confirmation.png)。
- 回滚点：上一正式部署 [6ad98564ac3b74535fd9623c](https://app.netlify.com/projects/pihou-pictag/deploys/6ad98564ac3b74535fd9623c)，对应代码 `4d8b29189e9f2e8131f82d97c87c5820ead32ee7`。如用户要求回滚，可在已核实的站点恢复此版本；本轮没有执行回滚。
- 本轮收尾只更新文档与证据，提交使用 `[skip netlify]`，不改变已验证的运行时代码；线上部署 commit 可能落后于最新的纯文档提交，这是有记录的差异。

## 第一轮同步与接力（历史）

用户确认暂按“本地开发/测试 → 安全同步功能分支 → 用户验收 → 明确批准合并/部署”执行。本轮先暂停部署，后在用户明确说“我测试了挺好的，接下来直接同步部署到服务器”后才发布；该批准不自动延伸到未来版本、付费、新凭据或无关设置。

早期因没有 Netlify connector、不能证明分支推送不会部署而未 push。之后在用户批准部署后，用官方 CLI 核实目标、现有登录、生产分支和发布状态，阻塞已解除。旧 CLI 缓存损坏，使用临时缓存运行同版本官方 CLI；未全局安装或改系统设置。Git 使用与已核实 GitHub 账号和上游一致的 noreply 身份；未改变全局 Git 配置。

本轮分工已完成，没有进行中的文件占用。协调 agent 负责 App/导出、集成测试和发布；geometry/UI agent 各自完成共用几何与界面；只读复核 agent 检查代码及远端证据。下一位先读实时 Git、此状态和最近迭代，再接新需求；旧副本保持原样，已知旧并发/CSS问题未擅自追加修复。侧栏仍待用户正常添加，不能绕过先前 UI 拒绝。

## 讨论与执行入口

本机 `PROJECT.local.md` 中的 GPT 产品迭代讨论入口 用于讨论需求；本 Codex 本地维护任务用于执行。文件与实时 Git 状态是执行依据，不承诺 GPT 自动读取本地文件或自动双向同步。

**Codex 侧栏项目未注册，本任务也未归入项目。** 公开工具可列出项目及归入已有项目，但未提供普通本地目录注册接口；读取 Codex UI 的尝试被应用控制工具拒绝，未重试或绕过。最小人工步骤：在 Codex 正常项目添加入口选择 `~/PIHOU-PicTag`，再将本任务移入该项目；按钮文案未核实。讨论会话不等于已注册侧栏项目。
