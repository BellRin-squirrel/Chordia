#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

# 1. 依存関係のインストール
echo "📦 1/3 依存関係を確認中..."
npm install

# 2. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 2/3 Expo Prebuild を実行中..."
npx expo prebuild --platform ios --clean --non-interactive

# 5. xcode によるビルド実行
echo "🔨 3/3 app をビルド中 (xcode)..."
xcodebuild -workspace ios/Chordia.xcworkspace \
           -scheme Chordia \
           -configuration Release \
           -sdk iphoneos \
           -derivedDataPath ./build \
           build \
           CODE_SIGNING_ALLOWED=NO

echo ""
echo "🎉 --- ビルドが完了しました！ ---"
echo "📂 生成されたappの場所:"
echo "   $(pwd)/build/Build/Products/Releas-iphones/Chordia.app"
