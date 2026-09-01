#!/bin/bash

# エラーが発生したら即座に処理を中断する
set -e

# 確実に mobile ディレクトリに移動する
cd "$(dirname "$0")"

echo "🚀 --- Android Release APK ローカルビルドを開始します ---"

# 1. 依存関係のインストール (破損したキャッシュを確実にクリア)
echo "📦 1/5 依存関係を確認中..."
rm -rf node_modules/react-native-track-player
npm install

# 2. react-native-track-player の Kotlin 2.x ＆ New Architecture (TurboModule) 互換性パッチを適用
echo "🛠️ 2/5 TrackPlayer パッチを適用中..."
node -e '
const fs = require("fs");
const file = "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt";

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  
  // パッチ1: Arguments.fromBundle( を Null-Safe な代替関数 fromBundleSafe に置換
  content = content.split("Arguments.fromBundle(").join("fromBundleSafe(");
  
  // パッチ2: fromBundleSafe 関数を MusicModule クラスの末尾の } の直前に挿入
  if (!content.includes("fun fromBundleSafe")) {
    const lastBraceIndex = content.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      const helper = `\n    private fun fromBundleSafe(bundle: android.os.Bundle?): com.facebook.react.bridge.WritableMap {\n        return if (bundle != null) com.facebook.react.bridge.Arguments.fromBundle(bundle) else com.facebook.react.bridge.Arguments.createMap()\n    }\n`;
      content = content.slice(0, lastBraceIndex) + helper + content.slice(lastBraceIndex);
    }
  }

  // パッチ3: New Architecture 起動クラッシュを回避するため、戻り値(Job)をカッコを解析してUnit(void)ブロックで包む
  let regex = /@ReactMethod\s+fun\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*=\s*[a-zA-Z0-9_\.]*launch\s*\{/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
      let startIndex = match.index + match[0].length - 1; // "{" の位置
      let openBraces = 0;
      let endIndex = -1;
      
      // カッコのペアを正確にカウントして関数の終わりを見つける
      for (let i = startIndex; i < content.length; i++) {
          if (content[i] === "{") openBraces++;
          if (content[i] === "}") openBraces--;
          if (openBraces === 0) {
              endIndex = i;
              break;
          }
      }
      
      if (endIndex !== -1) {
          let beforeEq = content.slice(0, match.index + match[0].indexOf("="));
          let afterEq = content.slice(match.index + match[0].indexOf("=") + 1, endIndex + 1);
          let afterBlock = content.slice(endIndex + 1);
          
          // "= scope.launch { ... }" を "{ scope.launch { ... } }" のブロック構文に変換
          content = beforeEq + "{" + afterEq + "\n    }" + afterBlock;
          
          // 文字列が書き換わったので検索インデックスをリセット
          regex.lastIndex = 0;
      }
  }

  fs.writeFileSync(file, content);
  console.log("   --> TrackPlayer のパッチ適用に成功しました。");
} else {
  console.log("   --> TrackPlayer が見つかりませんでした。スキップします。");
}
'

# 3. Expo Prebuild (ネイティブコードの生成)
echo "🏗️ 3/5 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform android --clean

# 4. 全CPUアーキテクチャ(x86/x86_64/ARM)対応 ＆ メモリ上限(4GB)拡張 ＆ Android 14 バックグラウンド再生維持パッチ
echo "⚙️ 4/5 ABI パッチ ＆ メモリ上限パッチ ＆ Android 14 バックグラウンド維持パッチを適用中..."
node -e '
const fs = require("fs");

// ABIフィルター追加
const gradleFile = "android/app/build.gradle";
if (fs.existsSync(gradleFile)) {
  let content = fs.readFileSync(gradleFile, "utf8");
  if (!content.includes("abiFilters")) {
    content = content.replace(/defaultConfig\s*\{/, "defaultConfig {\n        ndk {\n            abiFilters \"armeabi-v7a\", \"arm64-v8a\", \"x86\", \"x86_64\"\n        }");
    fs.writeFileSync(gradleFile, content);
    console.log("   --> 全CPUアーキテクチャ(x86/x86_64/ARM)の組み込みに成功しました。");
  }
}

// Gradle メモリ領域の拡張
const propFile = "android/gradle.properties";
if (fs.existsSync(propFile)) {
  let content = fs.readFileSync(propFile, "utf8");
  if (!content.includes("Xmx4096m")) {
    content += "\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m\n";
    fs.writeFileSync(propFile, content);
    console.log("   --> Gradle JVM メモリ上限を 4GB に拡張しました。");
  }
}

// Android 14+ Foreground Service (mediaPlayback) の Manifest 注入
const manifestFile = "android/app/src/main/AndroidManifest.xml";
if (fs.existsSync(manifestFile)) {
  let manifest = fs.readFileSync(manifestFile, "utf8");
  if (!manifest.includes("android:foregroundServiceType=\"mediaPlayback\"")) {
    const serviceTag = "<service android:name=\"com.doublesymmetry.trackplayer.service.MusicService\" android:exported=\"false\" android:foregroundServiceType=\"mediaPlayback\" />";
    manifest = manifest.replace("</application>", "    " + serviceTag + "\n  </application>");
    fs.writeFileSync(manifestFile, manifest);
    console.log("   --> Android 14 バックグラウンド再生用 ForegroundServiceType を追加しました。");
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