#!/bin/bash
# deploy.sh — 构建并部署到 Obsidian 插件目录
# 用法: cd ~/Downloads/cockpit-dashboard && bash deploy.sh

set -e

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$HOME/Downloads/Documents/Obsidian/.obsidian/plugins/cockpit-dashboard"

echo "🔧 构建 main.js..."
node "$SRC_DIR/build.js"

echo "📦 部署到 Obsidian 插件目录..."
cp "$SRC_DIR/main.js"        "$PLUGIN_DIR/main.js"
cp "$SRC_DIR/styles.css"     "$PLUGIN_DIR/styles.css"
cp "$SRC_DIR/manifest.json"  "$PLUGIN_DIR/manifest.json"

echo "✅ 部署完成！刷新 Obsidian 即可生效"
echo "   (data.json 未覆盖，保留用户配置)"
