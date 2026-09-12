#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

# 確実に mobile ディレクトリに移動する
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

# 1. 依存関係のインストール
echo "📦 1/5 依存関係を確認中..."
npm install

# 2. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 2/5 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform ios --clean

# 3. ChordiaEqualizer を Podfile に確実にリンクして pod install
echo "⚙️ 3/5 ChordiaEqualizer を Podfile に結合中..."
node -e '
const fs = require("fs");
const file = "ios/Podfile";
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("ChordiaEqualizer")) {
    content = content.replace("use_expo_modules!", "use_expo_modules!\n  pod \"ChordiaEqualizer\", :path => \"../modules/chordia-equalizer/ios\"");
    fs.writeFileSync(file, content);
    console.log("   --> Successfully linked ChordiaEqualizer into ios/Podfile");
  }
}
'
cd ios
pod install
cd ..

# 4. Xcodeビルド用スクリプト権限 ＆ Node環境変数の設定
echo "⚙️ 4/5 Xcode ビルド環境を準備中..."
find node_modules -type f -name "*.sh" -exec chmod +x {} \;

NODE_PATH=$(which node)
echo "export NODE_BINARY=$NODE_PATH" > ios/.xcode.env.local

# プロジェクト名(.xcworkspace)の自動取得
PROJECT_NAME=$(ls ios | grep .xcworkspace | sed 's/\.xcworkspace//')

# 5. xcodebuild による未署名ビルド実行
echo "🔨 5/5 app をビルド中 (xcodebuild)..."
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