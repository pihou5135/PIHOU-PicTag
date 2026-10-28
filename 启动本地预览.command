#!/bin/zsh -l
# Starts the local acceptance preview; no installs, remote sync or deployment.
set -eu
cd -- "${0:A:h}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if /usr/sbin/lsof -nP -iTCP:4173 -sTCP:LISTEN; then
  print '
4173 端口已有服务，本次没有再启动，也没有停止任何进程。'
  print '若是 PicTag，请打开 http://127.0.0.1:4173/；否则请先核对端口占用。'
  read -r '?按回车关闭此窗口…'
  exit 1
fi
if ! command -v npm >/dev/null 2>&1 || [[ ! -x node_modules/.bin/vite ]]; then
  print '未找到现有 Node/npm 或项目依赖，请回到维护任务检查；本脚本不会自动安装。'
  read -r '?按回车关闭此窗口…'
  exit 1
fi
print 'PicTag 本地验收：http://127.0.0.1:4173/'
print '请保留此终端窗口；停止服务请按 Ctrl+C。只监听本机，不同步或部署。'
exec npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
