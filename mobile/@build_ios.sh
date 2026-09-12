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
const path = require("path");

const iosDir = path.resolve("modules/chordia-equalizer/ios");
if (!fs.existsSync(iosDir)) {
  fs.mkdirSync(iosDir, { recursive: true });
}

const podspecContent = `require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name           = "ChordiaEqualizer"
  s.version        = package["version"]
  s.summary        = "Chordia Equalizer Module"
  s.description    = "Native Equalizer DSP module for Chordia Mobile"
  s.license        = "MIT"
  s.author         = "Chordia"
  s.homepage       = "https://github.com/BellRin-squirrel/Chordia"
  s.platforms      = { :ios => "15.1" }
  s.swift_version  = "5.0"
  s.source         = { :git => "" }
  s.static_framework = true

  s.dependency "ExpoModulesCore"

  s.source_files = "**/*.swift"
end
`;

fs.writeFileSync(path.join(iosDir, "ChordiaEqualizer.podspec"), podspecContent);
console.log("Successfully placed ChordiaEqualizer.podspec in modules/chordia-equalizer/ios/");

const podfile = "ios/Podfile";
if (fs.existsSync(podfile)) {
  let content = fs.readFileSync(podfile, "utf8");
  if (!content.includes("ChordiaEqualizer")) {
    content = content.replace("use_expo_modules!", "use_expo_modules!\n  pod \"ChordiaEqualizer\", :path => \"../modules/chordia-equalizer/ios\"");
    fs.writeFileSync(podfile, content);
    console.log("Successfully injected ChordiaEqualizer into ios/Podfile");
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