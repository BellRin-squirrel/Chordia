#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

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
echo "📂 生成されたappの場所:"
echo "   $(pwd)/build/Build/Products/Release-iphoneos/$PROJECT_NAME.app"