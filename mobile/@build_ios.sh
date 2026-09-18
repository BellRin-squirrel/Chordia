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

const wrongPod1 = path.join(iosDir, "chordia-equalizer.podspec");
const wrongPod2 = path.join(iosDir, "ChordiaEqualizer.podspec");
if (fs.existsSync(wrongPod1)) fs.unlinkSync(wrongPod1);
if (fs.existsSync(wrongPod2)) fs.unlinkSync(wrongPod2);

fs.writeFileSync(path.join(modDir, "package.json"), JSON.stringify({
  name: "chordia-equalizer",
  version: "0.1.0"
}, null, 2));

fs.writeFileSync(path.join(modDir, "expo-module.config.json"), JSON.stringify({
  name: "chordia-equalizer",
  platforms: ["ios", "apple", "android"],
  apple: {
    podspecPath: "ios/ChordiaEqualizer.podspec",
    modules: ["ChordiaEqualizerModule"]
  },
  ios: {
    podspecPath: "ios/ChordiaEqualizer.podspec",
    modules: ["ChordiaEqualizerModule"]
  },
  android: {
    modules: ["com.bellrin.chordia.equalizer.ChordiaEqualizerModule"]
  }
}, null, 2));

const podspec = `Pod::Spec.new do |s|
  s.name           = "ChordiaEqualizer"
  s.version        = "0.1.0"
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
end`;
fs.writeFileSync(path.join(iosDir, "ChordiaEqualizer.podspec"), podspec.trim());

const mainPkgPath = path.resolve("package.json");
let pkg = JSON.parse(fs.readFileSync(mainPkgPath, "utf8"));
if (!pkg.expo) pkg.expo = {};
if (!pkg.expo.autolinking) pkg.expo.autolinking = {};
pkg.expo.autolinking.nativeModulesDir = "./modules";
if (pkg.dependencies && pkg.dependencies["chordia-equalizer"]) {
   delete pkg.dependencies["chordia-equalizer"];
}
fs.writeFileSync(mainPkgPath, JSON.stringify(pkg, null, 2));
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
        if target.name.downcase.include?("fmt")
          target.build_configurations.each do |config|
            config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++17"
            config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] ||= ["$(inherited)"]
            config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] << "FMT_USE_CONSTEVAL=0"
          end
        end
      end
  `;
  if (content.includes("post_install do |installer|") && !content.includes("target.name.downcase.include?(\"fmt\")")) {
    content = content.replace("post_install do |installer|", "post_install do |installer|\n" + fmtPatch);
    fs.writeFileSync(podfile, content);
  }
}
'

cd ios
pod install
cd ..

# 4. fmt ライブラリ全体の再帰的ディープパッチ（consteval を完全無力化）
chmod -R u+w ios/Pods || true
node -e '
const fs = require("fs");
const path = require("path");

function walkAndPatch(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== ".git") walkAndPatch(fullPath);
    } else if (entry.endsWith(".h") || entry.endsWith(".cc") || entry.endsWith(".cpp")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let modified = false;

      if (content.includes("FMT_USE_CONSTEVAL")) {
        content = content.replace(/#\s*define\s+FMT_USE_CONSTEVAL\s+1/g, "#define FMT_USE_CONSTEVAL 0");
        content = "#undef FMT_USE_CONSTEVAL\n#define FMT_USE_CONSTEVAL 0\n" + content;
        modified = true;
      }

      if (content.includes("FMT_STRING(")) {
        content = content.replace(/#\s*define\s+FMT_STRING\s*\([^)]*\)[^\n]*/g, "#define FMT_STRING(s) (s)");
        content = "#undef FMT_STRING\n#define FMT_STRING(s) (s)\n" + content;
        modified = true;
      }

      if (modified) {
        try { fs.chmodSync(fullPath, 0o666); } catch (e) {}
        fs.writeFileSync(fullPath, content);
        console.log("Deep Patched:", fullPath);
      }
    }
  }
}

walkAndPatch(path.resolve("ios/Pods"));
walkAndPatch(path.resolve("node_modules/react-native"));
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