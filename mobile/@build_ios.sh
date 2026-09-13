#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

# 確実に mobile ディレクトリに移動する
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

echo "⚙️ 0/4 ローカルモジュール構成の自動セットアップ..."
node -e '
const fs = require("fs");
const path = require("path");

const modDir = path.resolve("modules/chordia-equalizer");
const iosDir = path.join(modDir, "ios");
if (!fs.existsSync(iosDir)) {
  fs.mkdirSync(iosDir, { recursive: true });
}

const oldPodspec = path.join(iosDir, "ChordiaEqualizer.podspec");
if (fs.existsSync(oldPodspec)) {
  fs.unlinkSync(oldPodspec);
}

fs.writeFileSync(path.join(modDir, "package.json"), JSON.stringify({
  name: "chordia-equalizer",
  version: "0.1.0",
  main: "index.ts"
}, null, 2));

fs.writeFileSync(path.join(modDir, "expo-module.config.json"), JSON.stringify({
  name: "chordia-equalizer",
  platforms: ["apple", "android"],
  apple: { modules: ["ChordiaEqualizerModule"] },
  android: { modules: ["com.bellrin.chordia.equalizer.ChordiaEqualizerModule"] }
}, null, 2));

const podspec = `Pod::Spec.new do |s|
  s.name           = "chordia-equalizer"
  s.version        = "0.1.0"
  s.summary        = "Chordia Equalizer"
  s.homepage       = "https://github.com/BellRin-squirrel/Chordia"
  s.author         = "Chordia"
  s.license        = "MIT"
  s.platforms      = { :ios => "15.1" }
  s.source         = { :git => "" }
  s.static_framework = true
  s.dependency "ExpoModulesCore"
  s.source_files = "ios/**/*.swift"
end`;
fs.writeFileSync(path.join(modDir, "chordia-equalizer.podspec"), podspec);

const mainPkgPath = path.resolve("package.json");
let pkg = JSON.parse(fs.readFileSync(mainPkgPath, "utf8"));
if (!pkg.dependencies["chordia-equalizer"]) {
   pkg.dependencies["chordia-equalizer"] = "file:./modules/chordia-equalizer";
   fs.writeFileSync(mainPkgPath, JSON.stringify(pkg, null, 2));
}
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
echo "📂 生成されたappの場所:"
echo "   $(pwd)/build/Build/Products/Release-iphoneos/$PROJECT_NAME.app"