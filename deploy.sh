#!/bin/bash
# deploy.sh — 构建并部署到 Obsidian 插件目录
# 用法:
#   bash deploy.sh           # 部署可读版 main.js
#   bash deploy.sh --min     # 部署压缩版 main.min.js 到插件目录的 main.js

set -e

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$HOME/Downloads/Documents/Obsidian/.obsidian/plugins/cockpit-dashboard"
MODE="${1:-}"
ENTRY_FILE="main.js"

if [ "$MODE" = "--min" ]; then
  ENTRY_FILE="main.min.js"
fi

echo "🔧 构建 ${ENTRY_FILE}..."
node "$SRC_DIR/build.js"

echo "📦 部署到 Obsidian 插件目录..."
cp "$SRC_DIR/$ENTRY_FILE"    "$PLUGIN_DIR/main.js"
cp "$SRC_DIR/styles.css"     "$PLUGIN_DIR/styles.css"
cp "$SRC_DIR/manifest.json"  "$PLUGIN_DIR/manifest.json"

echo "✅ 部署完成！刷新 Obsidian 即可生效"
echo "   (入口文件: $ENTRY_FILE -> main.js)"
echo "   (data.json 未覆盖，保留用户配置)"
