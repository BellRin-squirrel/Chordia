#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

echo "🚀 --- Android Release APK ローカルビルドを開始します ---"

# 1. 依存関係のインストール
echo "📦 1/5 依存関係を確認中..."
npm install

# 2. react-native-track-player の Kotlin 2.x 互換性パッチを適用
echo "🛠️ 2/5 TrackPlayer パッチを適用中..."
node -e '
const fs = require("fs");
const file = "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt";
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  content = content.split("Arguments.fromBundle(").join("fromBundleSafe(");
  const helper = `\n
private fun fromBundleSafe(bundle: android.os.Bundle?): com.facebook.react.bridge.WritableMap {
    return if (bundle != null) com.facebook.react.bridge.Arguments.fromBundle(bundle) else com.facebook.react.bridge.Arguments.createMap()
}
`;
  content += helper;
  fs.writeFileSync(file, content);
  console.log("   --> TrackPlayer のパッチ適用に成功しました。");
} else {
  console.log("   --> TrackPlayer が見つかりませんでした。スキップします。");
}
'

# 3. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 3/5 Expo Prebuild を実行中..."
npx expo prebuild --platform android --clean --non-interactive

# 4. 全CPUアーキテクチャ(x86/x86_64/ARM)対応パッチの適用
echo "⚙️ 4/5 エミュレータ＆実機対応 ABI パッチを適用中..."
node -e '
const fs = require("fs");
const file = "android/app/build.gradle";
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("abiFilters")) {
    content = content.replace(/defaultConfig\s*\{/, "defaultConfig {\n        ndk {\n            abiFilters \"armeabi-v7a\", \"arm64-v8a\", \"x86\", \"x86_64\"\n        }");
    fs.writeFileSync(file, content);
    console.log("   --> 全CPUアーキテクチャ(x86/x86_64/ARM)の組み込みに成功しました。");
  }
}
'

# 5. Gradle によるビルド実行
echo "🔨 5/5 APK をビルド中 (Gradle)..."
cd android
chmod +x ./gradlew
./gradlew assembleRelease

echo ""
echo "🎉 --- ビルドが完了しました！ ---"
echo "📂 生成されたAPKの場所:"
echo "   $(pwd)/app/build/outputs/apk/release/app-release.apk"