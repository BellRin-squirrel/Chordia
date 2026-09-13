#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "🚀 --- Android Release APK ローカルビルドを開始します ---"

echo "📦 1/4 依存関係を確認中..."
rm -rf node_modules/react-native-track-player
npm install

echo "🛠️ 2/4 TrackPlayer パッチを適用中..."
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

echo "🏗️ 3/4 Expo Prebuild を実行中..."
CI=1 npx expo prebuild --platform android --clean

echo "⚙️ 4/4 ABI & メモリパッチ適用中..."
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