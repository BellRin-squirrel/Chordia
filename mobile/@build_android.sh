#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

# 確実に mobile ディレクトリに移動する
cd "$(dirname "$0")"

echo "🚀 --- Android Release APK ローカルビルドを開始します ---"

echo "⚙️ 0/5 ローカルモジュール構成の自動セットアップ..."
node -e '
const fs = require("fs");
const path = require("path");
const modDir = path.resolve("modules/chordia-equalizer");
const iosDir = path.join(modDir, "ios");
if (!fs.existsSync(iosDir)) { fs.mkdirSync(iosDir, { recursive: true }); }
fs.writeFileSync(path.join(modDir, "package.json"), JSON.stringify({ name: "chordia-equalizer", version: "0.1.0", main: "index.ts" }, null, 2));
fs.writeFileSync(path.join(modDir, "expo-module.config.json"), JSON.stringify({ name: "chordia-equalizer", platforms: ["apple", "android"], apple: { modules: ["ChordiaEqualizerModule"] }, android: { modules: ["com.bellrin.chordia.equalizer.ChordiaEqualizerModule"] } }, null, 2));
const mainPkgPath = path.resolve("package.json");
let pkg = JSON.parse(fs.readFileSync(mainPkgPath, "utf8"));
if (!pkg.dependencies["chordia-equalizer"]) { pkg.dependencies["chordia-equalizer"] = "file:./modules/chordia-equalizer"; fs.writeFileSync(mainPkgPath, JSON.stringify(pkg, null, 2)); }
'

echo "📦 1/5 依存関係を確認中..."
rm -rf node_modules/react-native-track-player
npm install

echo "🛠️ 2/5 TrackPlayer パッチを適用中..."
node -e '
const fs = require("fs");
const file = "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt";
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  content = content.split("Arguments.fromBundle(").join("fromBundleSafe(");
  if (!content.includes("fun fromBundleSafe")) {
    const lastBraceIndex = content.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      const helper = `\n    private fun fromBundleSafe(bundle: android.os.Bundle?): com.facebook.react.bridge.WritableMap {\n        return if (bundle != null) com.facebook.react.bridge.Arguments.fromBundle(bundle) else com.facebook.react.bridge.Arguments.createMap()\n    }\n`;
      content = content.slice(0, lastBraceIndex) + helper + content.slice(lastBraceIndex);
    }
  }
  let regex = /@ReactMethod\s+fun\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*=\s*[a-zA-Z0-9_\.]*launch\s*\{/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
      let startIndex = match.index + match[0].length - 1; 
      let openBraces = 0;
      let endIndex = -1;
      for (let i = startIndex; i < content.length; i++) {
          if (content[i] === "{") openBraces++;
          if (content[i] === "}") openBraces--;
          if (openBraces === 0) { endIndex = i; break; }
      }
      if (endIndex !== -1) {
          let beforeEq = content.slice(0, match.index + match[0].indexOf("="));
          let afterEq = content.slice(match.index + match[0].indexOf("=") + 1, endIndex + 1);
          let afterBlock = content.slice(endIndex + 1);
          content = beforeEq + "{" + afterEq + "\n    }" + afterBlock;
          regex.lastIndex = 0;
      }
  }
  fs.writeFileSync(file, content);
}
'

echo "🏗️ 3/5 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform android --clean

echo "⚙️ 4/5 ABI パッチ ＆ メモリ上限パッチ ＆ Android 14 バックグラウンド維持パッチを適用中..."
node -e '
const fs = require("fs");
const gradleFile = "android/app/build.gradle";
if (fs.existsSync(gradleFile)) {
  let content = fs.readFileSync(gradleFile, "utf8");
  if (!content.includes("abiFilters")) {
    content = content.replace(/defaultConfig\s*\{/, "defaultConfig {\n        ndk {\n            abiFilters \"armeabi-v7a\", \"arm64-v8a\", \"x86\", \"x86_64\"\n        }");
    fs.writeFileSync(gradleFile, content);
  }
}
const propFile = "android/gradle.properties";
if (fs.existsSync(propFile)) {
  let content = fs.readFileSync(propFile, "utf8");
  if (!content.includes("Xmx4096m")) {
    content += "\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError\norg.gradle.parallel=true\n";
    fs.writeFileSync(propFile, content);
  }
}
const manifestFile = "android/app/src/main/AndroidManifest.xml";
if (fs.existsSync(manifestFile)) {
  let manifest = fs.readFileSync(manifestFile, "utf8");
  if (!manifest.includes("xmlns:tools=")) { manifest = manifest.replace("<manifest", "<manifest xmlns:tools=\"http://schemas.android.com/tools\""); }
  if (!manifest.includes("android:foregroundServiceType=\"mediaPlayback\"")) {
    const serviceTag = "<service android:name=\"com.doublesymmetry.trackplayer.service.MusicService\" android:exported=\"true\" android:foregroundServiceType=\"mediaPlayback\" tools:replace=\"android:exported,android:foregroundServiceType\" />";
    manifest = manifest.replace("</application>", "    " + serviceTag + "\n  </application>");
    fs.writeFileSync(manifestFile, manifest);
  }
}
'

echo "🔨 5/5 APK をビルド中 (Gradle)..."
cd android
chmod +x ./gradlew
./gradlew assembleRelease

echo ""
echo "🎉 --- ビルドが完了しました！ ---"
echo "📂 生成されたAPKの場所:"
echo "   $(pwd)/app/build/outputs/apk/release/app-release.apk"