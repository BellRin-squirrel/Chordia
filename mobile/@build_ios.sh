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

# 3. Xcode 16 の fmt 設定のみ Podfile に適用 (手動の pod 注入は削除)
echo "⚙️ 3/5 Xcode 16 設定を Podfile に適用中..."
node -e '
const fs = require("fs");
const podfile = "ios/Podfile";
if (fs.existsSync(podfile)) {
  let content = fs.readFileSync(podfile, "utf8");
  const fmtPatch = `
      if target.name == "fmt"
        target.build_configurations.each do |config|
          config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++17"
          config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] ||= ["$(inherited)"]
          config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] << "FMT_USE_CONSTEVAL=0"
        end
      end
  `;
  if (content.includes("post_install do |installer|") && !content.includes("target.name == \"fmt\"")) {
    content = content.replace("post_install do |installer|", "post_install do |installer|\n" + fmtPatch);
  }
  fs.writeFileSync(podfile, content);
  console.log("   --> Successfully configured ios/Podfile for Xcode 16");
}
'

cd ios
pod install
cd ..

# 4. fmt ヘッダーの確実なパッチ
node -e '
const fs = require("fs");
const path = require("path");

const fmtDir = path.resolve("ios/Pods/fmt/include/fmt");
if (fs.existsSync(fmtDir)) {
  const files = fs.readdirSync(fmtDir);
  files.forEach(f => {
    if (f.endsWith(".h")) {
      const filePath = path.join(fmtDir, f);
      let content = fs.readFileSync(filePath, "utf8");
      let modified = false;

      if (content.includes("FMT_USE_CONSTEVAL 1")) {
        content = content.replace(/#\s*define\s+FMT_USE_CONSTEVAL\s+1/g, "#define FMT_USE_CONSTEVAL 0");
        modified = true;
      }
      if (content.includes("FMT_STRING(")) {
        content = content.replace(/FMT_STRING\(/g, "(");
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log("   --> Patched fmt header:", f);
      }
    }
  });
}
'

# 5. Xcodeビルド用スクリプト権限 ＆ Node環境変数の設定
echo "⚙️ 4/5 Xcode ビルド環境を準備中..."
find node_modules -type f -name "*.sh" -exec chmod +x {} \;

NODE_PATH=$(which node)
echo "export NODE_BINARY=$NODE_PATH" > ios/.xcode.env.local

PROJECT_NAME=$(ls ios | grep .xcworkspace | sed 's/\.xcworkspace//')

# 6. xcodebuild による未署名ビルド実行
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