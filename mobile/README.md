# Chordia_Mobile
ここに記載されている説明はv4.0.0-beta1についてです。もし、このバージョンがChordia_Mobileの最新版でない場合は、READMEの変更があるまでお待ちください。当READMEの一部内容は現在執筆中です。更新があるまでもうしばらくお待ちください。

## 注意事項
アップデートについてはそれぞれのリリースノートをご確認ください。<br>
互換性情報はこのReadmeの最後に記述しております。<br>
現時点ではiOS版のデータ引継ぎは対応しておりません。予めご了承ください。
iPhone, iPadは以下iDeviceとします。

## このアプリについて
これはChordia_iOS_ipaというiDevice専用のアプリです。（iOSと名乗っておりますが、最近iPadでの動作確認も行っております。AppStoreに公開するのが予算の関係上難しいため、ipaファイルとしてリリースしております。）
アプリ内容についてですが、Desktop版から楽曲とプレイリストを同期して利用するものとなっております。<br>
おおよそオフラインでご利用いただけます。（楽曲を同期する際にはインターネット環境が必要となります）<br>
アプリ開発にはAIを利用しております。

## すぐ使いたいならここ読んで！（アプリの起動方法、使い方）
### アプリのインストール方法を動画でご覧いただきたい場合はこちらが参考になります。
- [Windows](https://www.youtube.com/watch?v=x_gvrT2tv-g)
- [Mac](https://www.youtube.com/watch?v=RqgGpe4KfGA)
### アプリのインストール方法　（iOS, iPadOS）
※ Android版のアプリインストール方法は準備中です。
アプリをインストールするにはパソコンが必ず必要です。（私はipaのインストールにSideloladyを推奨しております）
パソコンにSideloadlyがインストールされていることを確認し、iDeviceをパソコンとUSB有線で接続します。
パソコンのSideloladyを立ち上げ、IPAをクリックしてインストールしたいipaファイルを選択します。
インストール先のiDeviceにサインインしているAppleAccouuntにログインします。
ログインが完了したらStartをクリックします。
Doneと表示されたらiDeviceの方でChordiaがインストールされていることを確認します。
iDeviceの設定アプリ＞プライバシーとセキュリティ＞デベロッパーモードが有効になっていない場合は有効にして再起動してください。
iDeviceの設定アプリ＞一般＞VPNとデバイス管理＞自分のAppleIDをタップして検証等のボタンをタップします。これでアプリが起動できるようになりました。
iDeviceとDesktop版Chordiaを起動します。
Desktop版ChordiaでiPhoneに同期というボタンをクリックし、QRコードを表示というボタンをクリックします。
iDeviceのChordiaで同期タブを開き、QRコードで自動接続というボタンをタップします。カメラでDesktop版ChordiaのQRコードをスキャンします。
Desktop版の方で接続要求のポップアップが表示されるので、許可をクリックします。
※ iDeviceのカメラが故障しているなどによりスキャンできない場合は、Desktop版Chordiaに表示されているIPアドレスとポート番号を入力し、PCに接続要求をタップします。Desktop版Chordiaで許可したら、Desktop版Chordiaに表示されている認証コードをiDeviceのChordiaに入力します。これで接続することができます。
※ もし接続できない場合はDesktop版ChoridaのiPhoneに同期というウィンドウを一度閉じてからもう一度開いたり、Chordiaの再起動を試してください。基本的に接続できない要因はDesktop版にあります。
接続できたら同期したいプレイリストを選択して同期します。
同期が完了したら再生タブから楽曲を再生することができます。




## Desktop版とiOS版の互換性
互換性については[こちらのREADME](https://github.com/BellRin-squirrel/Chordia)をご確認ください。