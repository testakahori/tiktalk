// Style-Bert-VITS2 TTS API通信
// wavバイナリを取得してtempファイルに保存

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const log = require("electron-log");

class TTSEngine {
  /**
   * @param {{ baseUrl?: string, speakerId?: number, speed?: number }} options
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:5000";
    this.speakerId = options.speakerId ?? 0;
    this.speed = options.speed ?? 1.0;
  }

  /**
   * テキストを音声に変換してwavファイルパスを返す
   * @param {string} text
   * @returns {Promise<string|null>} wavファイルパス、エラー時はnull
   */
  async speak(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/voice`,
        {
          text,
          speaker_id: this.speakerId,
          speed: this.speed,
        },
        {
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );

      const tempFile = path.join(
        os.tmpdir(),
        `tiktalk_tts_${Date.now()}.wav`
      );
      fs.writeFileSync(tempFile, Buffer.from(response.data));
      return tempFile;
    } catch (err) {
      log.error("[TTS] speak エラー:", err.message, `text="${text.slice(0, 30)}..."`);
      return null;
    }
  }

  /**
   * TTS APIの疎通確認
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      await axios.get(`${this.baseUrl}/models/info`, { timeout: 5000 });
      return true;
    } catch {
      try {
        await axios.get(`${this.baseUrl}/docs`, { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  // checkHealth は isAvailable のエイリアス
  async checkHealth() {
    return this.isAvailable();
  }

  /**
   * 利用可能な話者リストを取得
   * @returns {Promise<Array<{ id: number, name: string }>>}
   */
  async getSpeakers() {
    try {
      const res = await axios.get(`${this.baseUrl}/models/info`, { timeout: 5000 });
      const data = res.data;
      // Style-Bert-VITS2の /models/info レスポンスから話者を抽出
      const speakers = [];
      if (data && typeof data === "object") {
        for (const [modelName, modelInfo] of Object.entries(data)) {
          if (modelInfo.id2spk) {
            for (const [id, name] of Object.entries(modelInfo.id2spk)) {
              speakers.push({ id: Number(id), name: `${name} (${modelName})` });
            }
          }
        }
      }
      return speakers;
    } catch (err) {
      log.error("[TTS] getSpeakers エラー:", err.message);
      return [];
    }
  }

  /**
   * オプションを動的に更新
   * @param {{ speakerId?: number, speed?: number, baseUrl?: string }} options
   */
  updateOptions(options) {
    if (options.speakerId !== undefined) this.speakerId = options.speakerId;
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.baseUrl !== undefined) this.baseUrl = options.baseUrl;
  }
}

module.exports = { TTSEngine };
