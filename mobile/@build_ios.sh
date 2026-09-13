#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

echo "⚙️ 0/4 削除された必須ファイル(podspec)の自動復元..."
node -e '
const fs = require("fs");
const path = require("path");

const modDir = path.resolve("modules/chordia-equalizer");
const iosDir = path.join(modDir, "ios");
if (!fs.existsSync(iosDir)) fs.mkdirSync(iosDir, { recursive: true });

const podspec = `Pod::Spec.new do |s|
  s.name           = "chordia-equalizer"
  s.version        = "1.0.0"
  s.summary        = "Chordia Equalizer"
  s.description    = "Chordia Equalizer"
  s.author         = "Chordia"
  s.homepage       = "https://github.com"
  s.platform       = :ios, "13.0"
  s.swift_version  = "5.4"
  s.source         = { :git => "" }
  s.static_framework = true
  s.dependency "ExpoModulesCore"
  s.source_files = "**/*.{h,m,swift}"
end`;
fs.writeFileSync(path.join(iosDir, "chordia-equalizer.podspec"), podspec.trim());
'

echo "📦 1/4 依存関係を確認中..."
npm install

echo "🏗️ 2/4 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform ios --clean

echo "⚙️ 3/4 Xcode ビルド環境を準備中..."
find node_modules -type f -name "*.sh" -exec chmod +x {} \;

NODE_PATH=$(which node)
echo "export NODE_BINARY=$NODE_PATH" > ios/.xcode.env.local

PROJECT_NAME=$(ls ios | grep .xcworkspace | sed 's/\.xcworkspace//')

echo "🔨 4/4 app をビルド中 (xcodebuild)..."
xcodebuild -workspace "ios/$PROJECT_NAME.xcworkspace" \
           -scheme "$PROJECT_NAME" \
           -configuration Release \
           -sdk iphoneos \
           -derivedDataPath ./build \
           build \
           CODE_SIGNING_ALLOWED=NO \
           CODE_SIGNING_REQUIRED=NO \
           CODE_SIGNING_IDENTITY="" \
           ENABLE_USER_SCRIPT_SANDBOXING=NO

echo ""
echo "🎉 --- ビルドが完了しました！ ---"