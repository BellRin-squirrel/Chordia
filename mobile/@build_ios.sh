#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

# 1. 依存関係のインストール
echo "📦 1/5 依存関係を確認中..."
npm install

# 2. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 2/5 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform ios --clean

# 3. ChordiaEqualizer を Podfile に確実にリンクし、fmt パッチを適用
echo "⚙️ 3/5 ChordiaEqualizer を結合＆Xcode 16 パッチを適用中..."
node -e '
const fs = require("fs");
const podfile = "ios/Podfile";
if (fs.existsSync(podfile)) {
  let content = fs.readFileSync(podfile, "utf8");
  if (!content.includes("ChordiaEqualizer")) {
    content = content.replace("use_expo_modules!", "use_expo_modules!\n  pod \"ChordiaEqualizer\", :path => \"../modules/chordia-equalizer/ios\"");
    fs.writeFileSync(podfile, content);
    console.log("   --> Successfully injected ChordiaEqualizer into ios/Podfile");
  }
}
'
cd ios
pod install
cd ..

node -e '
const fs = require("fs");
const fmtBase = "ios/Pods/fmt/include/fmt/base.h";
if (fs.existsSync(fmtBase)) {
  let content = fs.readFileSync(fmtBase, "utf8");
  content = content.replace(/#\s*define\s+FMT_USE_CONSTEVAL\s+1/g, "#define FMT_USE_CONSTEVAL 0");
  fs.writeFileSync(fmtBase, content);
  console.log("   --> Successfully patched fmt/base.h for Xcode 16");
}

const fmtInl = "ios/Pods/fmt/include/fmt/format-inl.h";
if (fs.existsSync(fmtInl)) {
  let content = fs.readFileSync(fmtInl, "utf8");
  content = content.replace(/FMT_STRING\(/g, "(");
  fs.writeFileSync(fmtInl, content);
  console.log("   --> Successfully patched fmt/format-inl.h for Xcode 16");
}
'

# 4. Xcodeビルド用スクリプト権限 ＆ Node環境変数の設定
echo "⚙️ 4/5 Xcode ビルド環境を準備中..."
find node_modules -type f -name "*.sh" -exec chmod +x {} \;

NODE_PATH=$(which node)
echo "export NODE_BINARY=$NODE_PATH" > ios/.xcode.env.local

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