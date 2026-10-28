# PIHOU-PicTag

浏览器端批量图片处理工具，使用 React、TypeScript 和 Vite。支持文字/图片水印、裁剪和缩放、格式转换、目标大小压缩，以及单图下载和 ZIP 批量导出。设置预设保存在当前浏览器的 localStorage。

## 项目入口

- **后续本地工作目录：`~/PIHOU-PicTag`**（本次已建立独立 Git 副本）。
- 代码仓库：[pihou5135/PIHOU-PicTag](https://github.com/pihou5135/PIHOU-PicTag)。
- 目标网站：[pihou-pictag.netlify.app](https://pihou-pictag.netlify.app/)。已核实绑定本仓库的 `main` 分支；本轮正式部署与回滚点见 [当前状态](docs/STATUS.md)。
- GPT 产品讨论入口保存在本机 `PROJECT.local.md`（不随 Git 同步）。
- Codex 执行入口：本次本地维护任务；后续在 Codex 中以此目录继续工作。GPT 用于产品讨论，本地文件和每次读取的 Git 状态是执行依据；不保证 GPT 自动读取本地目录，也没有自动双向同步。

**先读 [当前状态与下一步](docs/STATUS.md)，再按 [AGENTS.md](AGENTS.md) 开始或接力。** 具体工作记录见 [按日期的迭代记录](docs/ITERATIONS.md)。

> 旧副本 `~/Documents/codex-fabu/PIHOU-PicTag` 仍保留原位，其中 `.gitignore` 和 `netlify.toml` 有未提交改动，尚未迁移或判定应舍弃。首次功能变更前已核对：仅涉及 Netlify 本地忽略与构建设置，不影响本轮本地开发/测试，决定保持原样；未自动合并、覆盖或删除。

首轮边界提醒已正式上线。**第二轮文字/图片水印实时预览、第三轮图片水印方向移动已于2026-10-28同步GitHub并正式上线。** 生产功能提交 `0af6637`，部署与验证证据见[当前状态](docs/STATUS.md)。 本机测试入口为 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)，服务暂时保留；最新结果和停止方式见 [当前状态](docs/STATUS.md)。Codex 侧栏项目尚未注册：需在应用的正常项目添加入口选择已有文件夹 `~/PIHOU-PicTag`，再把本任务移入项目。

## 本地运行

本轮固定验收入口：双击 [启动本地预览.command](启动本地预览.command)，打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。保留启动后的终端窗口，按 Ctrl+C 停止；已有端口占用时启动器只提示，不停止其他进程。以下通用开发命令使用项目默认端口。

使用现有 Node.js / npm；本次验证环境为 Node.js `v24.13.0`、npm `11.6.2`。现有测试注明需要 Node.js 22.18+ 或 24+。

```sh
cd ~/PIHOU-PicTag
npm install --ignore-scripts --package-lock=false --no-audit --no-fund
npm run dev -- --host 127.0.0.1
```

新副本已完成上述依赖安装，可直接启动；开发服务器通常在 `http://127.0.0.1:3000`，以终端实际地址为准。停止服务使用 Ctrl+C。安装时禁用了依赖生命周期脚本，本次构建可正常完成。仓库当前没有依赖锁文件；版本范围可能在以后解析出不同版本，是否引入锁文件应作为单独的维护决定。

当前图片处理在浏览器 Canvas 中完成，源码未调用 Gemini API，**无需为现有功能设置 API key**。原模板保留的 `vite.config.ts` 环境变量映射未修改。页面引用 Tailwind CDN 和 Google Fonts，完整样式与字体仍依赖外部网络。

## 基础检查

```sh
npm run lint
node --test tests/*.test.mjs
npm run build
```

- `lint` 实际执行 TypeScript 的 `tsc --noEmit`。
- 测试通过 Node 原生测试运行器执行，仓库没有 `npm test` 脚本。
- 构建生成 `dist/`，不会发布网站。可用 `npm run preview -- --host 127.0.0.1` 本地预览。
- 这些检查不覆盖真实浏览器 Canvas 编码、ZIP 解压或线上版本；实际结果和已知警告见 [当前状态](docs/STATUS.md)。

## 代码与维护文件

| 位置 | 用途 |
| --- | --- |
| `App.tsx`、`index.tsx` | 应用状态、处理流程与入口 |
| `components/` | 设置面板与图片卡片 |
| `services/` | Canvas 处理、导出命名等逻辑 |
| `types.ts`、`constants.ts` | 类型与默认配置 |
| `tests/` | 已有导出回归测试 |
| [AGENTS.md](AGENTS.md) | agent 开工、协作和交付约定 |
| [docs/STATUS.md](docs/STATUS.md) | 最新状态、未解决事项、下一步 |
| [docs/ITERATIONS.md](docs/ITERATIONS.md) | 按日期追加的变更、验证与决策记录 |

保留仓库现有根目录源码布局，不另建 `src/` 或重复工作副本。原始 AI Studio 入口：[原项目](https://ai.studio/apps/f94d35ed-ecb2-4988-a745-9270b9a18741)。当前采用：本地开发/测试 → 确认不会自动部署后同步独立功能分支 → 用户验收 → 另行确认才合并/部署。用户已完成第一轮发布及第二轮本地验收，并于2026-10-28明确批准第二/三轮最新功能同步与正式发布；每轮仍以当次明确授权为准。不能将此流程视为永久自动发布授权。

## 本轮边界提醒的验证

启用“统一裁切尺寸”后，缩小或拖动到露边时，预览显示橙色区域及中文方向提醒。单图和 ZIP 下载前列出问题图片，可返回调整或仍然导出。设置/位置改变会清除旧处理结果，需要重新“应用到所有图片”。提醒仅为界面辅助层，不进入下载图片。

已有 Playwright 和 Chrome 的环境可复跑 `node tests/browser-boundary.cjs`；若 Playwright 不在项目依赖路径，可用 `PICTAG_PLAYWRIGHT_MODULE` 指定已有模块路径，`PICTAG_TEST_URL` 指定测试地址（默认 4173）。脚本不会安装软件，生成的本地测试产物写入已忽略的 `output/playwright/`。本轮结果与截图见 [当前状态](docs/STATUS.md)。

## 第二轮：文字与图片水印实时预览

上传目标图片后，文字内容和现有样式、图片水印的选择/替换/尺寸/位置/透明度会立即反映在可见卡片中，不必先应用。水印设置仍为全局，每张图保留独立的裁切、缩放、拖动与复位；没有新增单图水印编辑模式或字体。文字 opacity/usePrefix 原来仅由预设支持，本轮保持其范围并实时展示。

预览与导出共用 Canvas 绘制。预览位图上限 1024px，可见卡片按动画帧合并更新；不可见卡片延后重绘，文字/图片资源使用有限缓存。编辑预览不编码整批原图，点击“应用到所有图片”才生成下载结果。快速加载旧结果不会覆盖新选择，图片水印仍全部在浏览器本地处理。生成结果后再次编辑会使旧下载结果失效。

本轮浏览器验证命令：已有 Playwright 和 Chrome 时运行 `node tests/browser-watermark.cjs`；模块和服务地址仍使用 `PICTAG_PLAYWRIGHT_MODULE` / `PICTAG_TEST_URL`。第一轮回归使用 `node tests/browser-boundary.cjs`。只同步而不部署的阶段须先核实自动部署风险；本轮已获2026-10-28明确授权并完成正式发布。


## 第三轮：图片水印方向移动

选择图片水印后，在“水印位置”下面用上、下、左、右按钮移动，方向与画面一致；每次移动距离可选1/10/50像素，中间“复位”恢复原定位。方向按钮获得焦点后，也可直接使用键盘四方向键。只移动图片水印，不移动文字或源图，预览立即更新。

移动位置可保存到预设，旧预设保持原定位；步长只是操作选项，不写入预设。预览和导出共用坐标，超画布部分不显示；没有自动避让或直接拖拽水印。移动后再次“应用到所有图片”生成最新下载。已有Playwright可运行 `node tests/browser-watermark-position.cjs`（支持 `PICTAG_PLAYWRIGHT_MODULE` / `PICTAG_TEST_URL`）；最新结果见 [当前状态](docs/STATUS.md)。本轮已于2026-10-28正式上线，发布证据及回滚点见上方接力记录。
