# TikTalk 🎮

TikTokゲーム配信向けのコメント読み上げデスクトップアプリです。
TikTokライブのコメントをリアルタイムで取得し、Style-Bert-VITS2で自然に読み上げます。

## ダウンロードして使う（Windows）

### システム要件
- **OS**: Windows 10 以上
- **GPU**: 推奨（Style-Bert-VITS2の音声合成を高速化）
- **メモリ**: 8GB以上推奨

### インストール手順

1. [Releases](https://github.com/Nicolas0315/tiktalk/releases) から最新の `TikTalk-Setup-X.X.X.exe` をダウンロード
2. ダウンロードしたファイルを実行（Windows SmartScreen の警告が出た場合は「詳細情報」→「実行」）
3. インストーラーの指示に従ってインストール

### 追加で必要なソフトウェア

#### Style-Bert-VITS2（音声合成サーバー）
TikTalkはローカルで動作するTTSサーバーを使ってコメントを読み上げます。

- **入手先**: https://github.com/litagin02/Style-Bert-VITS2
- **セットアップ方法**: リポジトリのREADMEを参照
- APIサーバーが `http://localhost:5000` で動作している必要があります

## 使い方

1. Style-Bert-VITS2のAPIサーバーを起動
2. TikTalkを起動
3. TikTokのユーザー名を入力（例: `@username`）
4. 「配信開始」ボタンをクリック
5. ライブ配信のコメントが自動で読み上げられます

## 開発者向け

### 必要なもの

- **Node.js** (v18以上): https://nodejs.org/
- **Python** (3.10以上): https://www.python.org/
- **Style-Bert-VITS2**: ローカルTTSサーバー

### セットアップ

```bash
# Python依存パッケージ
cd python
pip install -r requirements.txt
cd ..

# Node.js依存パッケージ
npm install
```

### 開発モードで起動

ターミナルを2つ開きます。

**ターミナル1: Vite dev server**
```bash
npm run dev
```

**ターミナル2: Electron**
```bash
npx electron .
```

### exe化（Windows配布用）

```bash
# アイコン生成
npm install --save-dev sharp
node scripts/generate-icon.js

# ビルド
npm run build
```

`release/` フォルダにインストーラーが生成されます。

## よくある質問

### 「Style-Bert-VITS2 が起動していません」と表示される
Style-Bert-VITS2のAPIサーバーを先に起動してください。
`http://localhost:5000` でアクセスできるか確認してください。

### コメントが取得できない
- ユーザー名が正しいか確認してください（@は省略可能）
- 配信がライブ中であることを確認してください
- インターネット接続を確認してください

### TTSサーバーに接続できない
- Style-Bert-VITS2が起動しているか確認してください
- ポート5000が他のアプリに使われていないか確認してください
- ファイアウォール設定で localhost:5000 がブロックされていないか確認してください
