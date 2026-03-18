# TikTalk 🎮

TikTokゲーム配信向けのコメント読み上げデスクトップアプリです。
TikTokライブのコメントをリアルタイムで取得し、Style-Bert-VITS2で自然に読み上げます。

## ダウンロード

最新版は [Releases](https://github.com/Nicolas0315/tiktalk/releases) からダウンロードできます。

`TikTalk-Setup-X.X.X.exe` をダウンロードして実行してください。

## 必要なもの

- **Node.js** (v18以上): https://nodejs.org/
- **Python** (3.10以上): https://www.python.org/
- **Style-Bert-VITS2**: ローカルTTSサーバー

## セットアップ手順

### 1. Style-Bert-VITS2 をセットアップ

Style-Bert-VITS2をダウンロードして起動してください。
APIサーバーが `http://localhost:5000` で動作している必要があります。

- リポジトリ: https://github.com/litagin02/Style-Bert-VITS2
- セットアップ方法はリポジトリのREADMEを参照

### 2. Python依存パッケージをインストール

```bash
cd python
pip install -r requirements.txt
```

### 3. Node.js依存パッケージをインストール

```bash
npm install
```

### 4. 開発モードで起動

ターミナルを2つ開きます。

**ターミナル1: Vite dev server**
```bash
npm run dev
```

**ターミナル2: Electron**
```bash
npx electron .
```

### 5. 使い方

1. Style-Bert-VITS2のAPIサーバーを起動
2. TikTalkを起動
3. TikTokのユーザー名を入力（例: `@username`）
4. 「配信開始」ボタンをクリック
5. ライブ配信のコメントが自動で読み上げられます

## exe化（Windows配布用）

```bash
# Python部分をexe化
cd python
pip install pyinstaller
pyinstaller --onefile tiktok_reader.py

# distフォルダのtiktok_reader.exeをpython/に配置
copy dist\tiktok_reader.exe .

# Electronアプリをexe化
cd ..
npm run build
```

`release/` フォルダにインストーラーが生成されます。

## トラブルシューティング

- **「Style-Bert-VITS2 が起動していません」と表示される**
  → Style-Bert-VITS2のAPIサーバーを先に起動してください

- **コメントが取得できない**
  → ユーザー名が正しいか確認してください（@は省略可能）
  → 配信がライブ中であることを確認してください
