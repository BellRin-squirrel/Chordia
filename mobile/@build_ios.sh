#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "🚀 --- iOS Release app ローカルビルドを開始します ---"

echo "⚙️ 0/5 ローカルモジュール構成の自動セットアップ..."
node -e '
const fs = require("fs");
const path = require("path");

const modDir = path.resolve("modules/chordia-equalizer");
const iosDir = path.join(modDir, "ios");
if (!fs.existsSync(iosDir)) fs.mkdirSync(iosDir, { recursive: true });

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

const podspec = `require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name           = "chordia-equalizer"
  s.version        = package["version"]
  s.summary        = "Chordia Equalizer Module"
  s.description    = "Native Equalizer DSP module for Chordia Mobile"
  s.license        = "MIT"
  s.author         = "Chordia"
  s.homepage       = "https://github.com/BellRin-squirrel/Chordia"
  s.platforms      = { :ios => "15.1" }
  s.swift_version  = "5.4"
  s.source         = { :git => "" }
  s.static_framework = true
  s.dependency "ExpoModulesCore"
  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"
end`;

fs.writeFileSync(path.join(modDir, "chordia-equalizer.podspec"), podspec.trim());
fs.writeFileSync(path.join(modDir, "ChordiaEqualizer.podspec"), podspec.trim());

const mainPkgPath = path.resolve("package.json");
let pkg = JSON.parse(fs.readFileSync(mainPkgPath, "utf8"));
if (!pkg.dependencies["chordia-equalizer"]) {
   pkg.dependencies["chordia-equalizer"] = "file:./modules/chordia-equalizer";
   fs.writeFileSync(mainPkgPath, JSON.stringify(pkg, null, 2));
}
'

# 1. 依存関係のインストール
echo "📦 1/5 依存関係を確認中..."
npm install

# 2. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 2/5 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform ios --clean

# 3. Xcode 16 の fmt 設定を Podfile に適用
echo "⚙️ 3/5 Xcode 16 設定を Podfile に適用中..."
node -e '
const fs = require("fs");
const podfile = "ios/Podfile";
if (fs.existsSync(podfile)) {
  let content = fs.readFileSync(podfile, "utf8");
  const fmtPatch = `
    installer.pods_project.targets.each do |target|
      if target.name == "fmt"
        target.build_configurations.each do |config|
          config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++17"
          config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] ||= ["$(inherited)"]
          config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] << "FMT_USE_CONSTEVAL=0"
        end
      end
    end
  `;
  if (content.includes("post_install do |installer|") && !content.includes("target.name == \"fmt\"")) {
    content = content.replace("post_install do |installer|", "post_install do |installer|\n" + fmtPatch);
  }
  fs.writeFileSync(podfile, content);
}
'

cd ios
pod install
cd ..

# 4. fmt ヘッダーの確実なパッチ
chmod -R u+w ios/Pods || true
node -e '
const fs = require("fs");
const path = require("path");

const fmtBase = path.resolve("ios/Pods/fmt/include/fmt/base.h");
if (fs.existsSync(fmtBase)) {
  let content = fs.readFileSync(fmtBase, "utf8");
  content = content.replace(/#\s*define\s+FMT_USE_CONSTEVAL\s+1/g, "#define FMT_USE_CONSTEVAL 0");
  fs.writeFileSync(fmtBase, content);
}

const fmtHeader = path.resolve("ios/Pods/fmt/include/fmt/format.h");
if (fs.existsSync(fmtHeader)) {
  let content = fs.readFileSync(fmtHeader, "utf8");
  content = content.replace(/#define\s+FMT_STRING\(s\)\s+FMT_STRING_IMPL[^\n]+/g, "#define FMT_STRING(s) (s)");
  fs.writeFileSync(fmtHeader, content);
}

const fmtInl = path.resolve("ios/Pods/fmt/include/fmt/format-inl.h");
if (fs.existsSync(fmtInl)) {
  let content = fs.readFileSync(fmtInl, "utf8");
  content = content.replace(/FMT_STRING\(([^)]+)\)/g, "($1)");
  fs.writeFileSync(fmtInl, content);
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