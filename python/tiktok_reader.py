"""
TikTalk - TikTokライブコメント取得 & Style-Bert-VITS2 読み上げ

使い方: python tiktok_reader.py <TikTokユーザー名>
"""

import sys
import json
import time
import re
import io
import threading
import queue

import requests
import emoji
import sounddevice as sd
from scipy.io import wavfile
from TikTokLive import TikTokLiveClient
from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent

# 読み上げキュー（音声が重ならないように順番に再生）
speech_queue = queue.Queue()

# 連投検出用: {ユーザー名: 最終コメント時刻}
last_comment_time = {}
REPEAT_THRESHOLD = 30  # 秒

# Style-Bert-VITS2 API設定
TTS_URL = "http://localhost:5000/voice"
TTS_PARAMS = {
    "model_id": 0,
    "speaker_id": 0,
    "sdp_ratio": 0.2,
    "noise": 0.6,
    "noisew": 0.8,
    "length": 1.0,
    "language": "JP",
    "auto_split": True,
    "split_interval": 0.5,
}


def output_json(data):
    """JSONLを標準出力に書き出す（Electronが受信する）"""
    print(json.dumps(data, ensure_ascii=False), flush=True)


def clean_text(text):
    """コメントテキストの整形（emoji除去、URL除去）"""
    # emoji除去
    text = emoji.replace_emoji(text, replace="")
    # URL除去
    text = re.sub(r'https?://\S+', '', text)
    # 余分な空白を整理
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def make_speech_text(username, comment):
    """読み上げテキストを生成（連投簡略化対応）"""
    now = time.time()
    if username in last_comment_time and (now - last_comment_time[username]) < REPEAT_THRESHOLD:
        speech_text = f"また{username}さん、{comment}"
    else:
        speech_text = f"{username}さん、{comment}"
    last_comment_time[username] = now
    return speech_text


def speak(text):
    """Style-Bert-VITS2でTTS再生"""
    try:
        params = {**TTS_PARAMS, "text": text}
        resp = requests.get(TTS_URL, params=params, timeout=15)
        if resp.status_code != 200:
            sys.stderr.write(f"TTS APIエラー: {resp.status_code}\n")
            return

        # WAVデータを読み込んで再生
        wav_io = io.BytesIO(resp.content)
        sample_rate, audio_data = wavfile.read(wav_io)
        sd.play(audio_data, samplerate=sample_rate)
        sd.wait()  # 再生完了を待つ
    except requests.ConnectionError:
        sys.stderr.write("TTS未接続: Style-Bert-VITS2が起動していません\n")
    except Exception as e:
        sys.stderr.write(f"TTS再生エラー: {e}\n")


def speech_worker():
    """読み上げキューを順番に処理するワーカースレッド"""
    while True:
        text = speech_queue.get()
        if text is None:
            break
        speak(text)
        speech_queue.task_done()


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("使い方: python tiktok_reader.py <TikTokユーザー名>\n")
        sys.exit(1)

    username = sys.argv[1].lstrip("@")

    # 読み上げワーカー起動
    worker = threading.Thread(target=speech_worker, daemon=True)
    worker.start()

    # TikTokLiveクライアント作成
    client = TikTokLiveClient(unique_id=username)

    @client.on(ConnectEvent)
    async def on_connect(event):
        output_json({"type": "status", "status": "connected", "user": username})

    @client.on(DisconnectEvent)
    async def on_disconnect(event):
        output_json({"type": "status", "status": "disconnected"})

    @client.on(CommentEvent)
    async def on_comment(event):
        commenter = event.user.nickname or event.user.unique_id
        raw_comment = event.comment
        comment = clean_text(raw_comment)

        if not comment:
            return

        # ElectronにJSON出力
        output_json({
            "type": "comment",
            "user": commenter,
            "comment": comment,
        })

        # 読み上げテキスト生成してキューに追加
        speech_text = make_speech_text(commenter, comment)
        speech_queue.put(speech_text)

    try:
        output_json({"type": "status", "status": "connecting", "user": username})
        client.run()
    except Exception as e:
        output_json({"type": "status", "status": "error", "message": str(e)})
        sys.exit(1)


if __name__ == "__main__":
    main()
