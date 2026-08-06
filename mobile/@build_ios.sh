#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

# ★ 1. 確実に mobile ディレクトリに移動する
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

# 2. 依存関係のインストール
echo "📦 1/4 依存関係を確認中..."
npm install

# 3. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 2/4 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform ios --clean

# 4. Xcodeビルド用スクリプト権限 ＆ Node環境変数の設定
echo "⚙️ 3/4 Xcode ビルド環境を準備中..."
find node_modules -type f -name "*.sh" -exec chmod +x {} \;

NODE_PATH=$(which node)
echo "export NODE_BINARY=$NODE_PATH" > ios/.xcode.env.local

# プロジェクト名(.xcworkspace)の自動取得
PROJECT_NAME=$(ls ios | grep .xcworkspace | sed 's/\.xcworkspace//')

# 5. xcodebuild による未署名ビルド実行
echo "🔨 4/4 app をビルド中 (xcodebuild)..."
xcodebuild -workspace "ios/$PROJECT_NAME.xcworkspace" \
           -scheme "$PROJECT_NAME" \
           -configuration Release \
           -sdk iphoneos \
           -derivedDataPath ./build \
           build \
           CODE_SIGNING_ALLOWED=NO \
           CODE_SIGNING_REQUIRED=NO \
           CODE_SIGN_IDENTITY="" \
           ENABLE_USER_SCRIPT_SANDBOXING=NO

echo ""
echo "🎉 --- ビルドが完了しました！ ---"
echo "📂 生成されたappの場所:"
# ★ 誤字(Releas-iphones)を Release-iphoneos に修正
echo "   $(pwd)/build/Build/Products/Release-iphoneos/$PROJECT_NAME.app"