// 讯飞 Speech-to-Text Service - 方言识别大模型 (SLM) + 中文识别大模型 fallback
// v2.4 - 方言大模型 license 失败(11201/11203)时自动 fallback 到中文识别大模型
// API文档(方言): https://www.xfyun.cn/doc/spark/spark_slm_iat.html
// API文档(中文): https://www.xfyun.cn/doc/asr/voicedictation/API.html

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as WebSocket from 'ws';
import { fetchWithRetry } from '../../common/utils/fetch-with-retry';

const execAsync = promisify(exec);

// 方言识别大模型 API 配置
const XUNFEI_WSS_URL = 'wss://iat.cn-huabei-1.xf-yun.com/v1';
const XUNFEI_HOST = 'iat.cn-huabei-1.xf-yun.com';
const XUNFEI_PATH = '/v1';

// 中文识别大模型 API 配置（fallback）
const CHINESE_WSS_URL = 'wss://iat-api.xfyun.cn/v2/iat';
const CHINESE_HOST = 'iat-api.xfyun.cn';
const CHINESE_PATH = '/v2/iat';

const FRAME_SIZE = 1280;
const FRAME_INTERVAL = 40;
const STT_TIMEOUT_MS = 60000;

// 触发 fallback 的 license 相关错误码
const LICENSE_ERROR_CODES = new Set([11201, 11203]);

// 方言大模型响应格式
interface SlmResponse {
  header: {
    code: number;
    message: string;
    sid: string;
    status: number;
  };
  payload?: {
    result?: {
      text: string; // base64 编码的 JSON
    };
  };
}

// base64 解码后的识别结果
interface SlmResultText {
  ws: Array<{
    bg: number;
    cw: Array<{ w: string; wp?: string }>;
  }>;
}

@Injectable()
export class XunfeiSttService {
  private readonly logger = new Logger(XunfeiSttService.name);

  async transcribe(audioUrl: string, timeoutMs: number = STT_TIMEOUT_MS): Promise<string> {
    const appId = process.env.XUNFEI_APP_ID;
    const apiKey = process.env.XUNFEI_API_KEY;
    const apiSecret = process.env.XUNFEI_API_SECRET;

    if (!appId || !apiKey || !apiSecret) {
      throw new Error('讯飞 credentials not configured');
    }

    // Step 1: Download audio
    const audioBuffer = await this.downloadAudio(audioUrl);
    this.logger.log(`Audio downloaded: ${(audioBuffer.length / 1024).toFixed(1)}KB`);

    // Step 2: Convert to PCM if needed
    const format = this.detectAudioFormat(audioUrl, audioBuffer);
    let pcmBuffer: Buffer;
    if (format === 'pcm') {
      pcmBuffer = audioBuffer;
    } else {
      pcmBuffer = await this.convertToPcm(audioBuffer, format);
      this.logger.log(`Converted ${format}→PCM: ${(pcmBuffer.length / 1024).toFixed(1)}KB`);
    }

    // Step 3: 优先用方言大模型，license 失败时 fallback 到中文识别大模型
    try {
      const wsUrl = this.buildAuthUrl(apiKey, apiSecret, XUNFEI_HOST, XUNFEI_PATH, XUNFEI_WSS_URL);
      return await this.sendAudioAndGetTranscript(wsUrl, appId, pcmBuffer, timeoutMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = this.extractErrorCode(msg);
      if (LICENSE_ERROR_CODES.has(code)) {
        this.logger.warn(`方言大模型 license 失败(${code})，fallback 到中文识别大模型`);
        const wsUrl = this.buildAuthUrl(apiKey, apiSecret, CHINESE_HOST, CHINESE_PATH, CHINESE_WSS_URL);
        return await this.sendAudioChineseModel(wsUrl, appId, pcmBuffer, timeoutMs);
      }
      throw err;
    }
  }

  // 从错误消息中提取错误码（如 "STT错误: 11201 - licc failed" → 11201）
  private extractErrorCode(message: string): number {
    const match = message.match(/(\d{4,5})/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private detectAudioFormat(url: string, buffer: Buffer): string {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.webm')) return 'webm';
    if (urlLower.includes('.mp4') || urlLower.includes('.m4a')) return 'mp4';
    if (urlLower.includes('.wav')) return 'wav';
    if (urlLower.includes('.mp3')) return 'mp3';
    if (urlLower.includes('.ogg')) return 'ogg';
    if (urlLower.includes('.pcm')) return 'pcm';

    if (buffer.length >= 4) {
      if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm';
      if (buffer.toString('ascii', 0, 4) === 'RIFF') return 'wav';
      if ((buffer[0] === 0xff && buffer[1] === 0xfb) || buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
      if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
      // MP4/M4A: 'ftyp' at offset 4
      if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
    }
    return 'webm';
  }

  private async downloadAudio(url: string): Promise<Buffer> {
    const response = await fetchWithRetry(url, undefined, {
      maxRetries: 3,
      baseDelayMs: 1000,
    });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async convertToPcm(audioBuffer: Buffer, originalFormat: string): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `input_${Date.now()}.${originalFormat}`);
    const outputFile = path.join(tempDir, `output_${Date.now()}.pcm`);

    try {
      fs.writeFileSync(inputFile, audioBuffer);
      const ffmpegCmd = `ffmpeg -i "${inputFile}" -ar 16000 -ac 1 -f s16le "${outputFile}" -y 2>/dev/null`;
      await execAsync(ffmpegCmd);
      return fs.readFileSync(outputFile);
    } finally {
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // 通用鉴权URL构建，支持方言大模型和中文大模型两个端点
  private buildAuthUrl(apiKey: string, apiSecret: string, host: string, path: string, wssBase: string): string {
    const date = new Date().toUTCString();

    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    const params = new URLSearchParams({ authorization, date, host });
    return `${wssBase}?${params.toString()}`;
  }

  // 方言大模型WebSocket通信 + 响应解析（非流式，直接拼接最终结果）
  private sendAudioAndGetTranscript(wsUrl: string, appId: string, audioBuffer: Buffer, timeoutMs: number = STT_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const transcriptParts: string[] = [];
      let frameIndex = 0;
      const totalFrames = Math.ceil(audioBuffer.length / FRAME_SIZE);
      let isResolved = false;

      const resolveWithResults = (reason: string) => {
        if (isResolved) return;
        isResolved = true;
        const finalTranscript = transcriptParts.join('');
        this.logger.log(`STT完成(${reason}): ${finalTranscript.length}字`);
        resolve(finalTranscript);
      };

      const timeout = setTimeout(() => {
        ws.close();
        if (transcriptParts.length > 0) {
          resolveWithResults('timeout-partial');
        } else {
          reject(new Error(`STT超时(${timeoutMs / 1000}s)`));
        }
      }, timeoutMs);

      ws.on('open', () => {
        this.logger.log(`STT开始(方言大模型): ${totalFrames}帧`);
        this.sendFrames(ws, appId, audioBuffer, frameIndex, totalFrames);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const response: SlmResponse = JSON.parse(data.toString());

          if (response.header.code !== 0) {
            clearTimeout(timeout);
            ws.close();
            // 若已有部分转写结果，优先使用已有内容而非直接报错
            if (transcriptParts.length > 0) {
              this.logger.warn(`STT code ${response.header.code} (${response.header.message})，已有内容 ${transcriptParts.join('').length} 字，使用部分结果`);
              resolveWithResults('error-partial');
            } else {
              reject(new Error(`STT错误: ${response.header.code} - ${response.header.message}`));
            }
            return;
          }

          // 解析 base64 编码的识别结果，直接追加
          if (response.payload?.result?.text) {
            const decoded = Buffer.from(response.payload.result.text, 'base64').toString('utf-8');
            const result: SlmResultText = JSON.parse(decoded);
            const text = result.ws
              ?.map((w) => w.cw.map((c) => c.w).join(''))
              .join('') || '';
            if (text) transcriptParts.push(text);
          }

          // status=2 表示识别结束
          if (response.header.status === 2) {
            clearTimeout(timeout);
            ws.close();
            resolveWithResults('complete');
          }
        } catch (error) {
          // Ignore parse errors
        }
      });

      ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        if (transcriptParts.length > 0) {
          resolveWithResults('error-partial');
        } else {
          reject(new Error(`WebSocket错误: ${error.message}`));
        }
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!isResolved && transcriptParts.length > 0) {
          resolveWithResults('closed');
        }
      });
    });
  }

  // 方言大模型帧发送：每帧都需要 header.status
  private sendFrames(ws: WebSocket, appId: string, audioBuffer: Buffer, startFrame: number, totalFrames: number): void {
    let frameIndex = startFrame;

    const sendNext = () => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const start = frameIndex * FRAME_SIZE;
      const end = Math.min(start + FRAME_SIZE, audioBuffer.length);
      const chunk = audioBuffer.subarray(start, end);

      let status: number;
      if (frameIndex === 0) {
        status = 0;
      } else if (frameIndex >= totalFrames - 1) {
        status = 2;
      } else {
        status = 1;
      }

      // 方言大模型：每帧都需要 header + payload
      const message: any = {
        header: { app_id: appId, status },
        payload: {
          audio: {
            encoding: 'raw',
            sample_rate: 16000,
            channels: 1,
            bit_depth: 16,
            status,
            seq: frameIndex,
            audio: chunk.toString('base64'),
          },
        },
      };

      // 首帧携带 parameter
      if (frameIndex === 0) {
        message.parameter = {
          iat: {
            language: 'zh_cn',
            accent: 'mulacc',   // 多方言自动识别(202种方言)
            domain: 'slm',      // 方言大模型
            eos: 10000,         // 静音检测(ms)，最大值防止对话停顿被截断
            ptt: 1,             // 开启标点
            nunum: 1,           // 数字规整
            result: {
              encoding: 'utf8',
              compress: 'raw',
              format: 'json',
            },
          },
        };
      }

      ws.send(JSON.stringify(message));
      frameIndex++;

      if (status !== 2) {
        setTimeout(sendNext, FRAME_INTERVAL);
      }
    };

    sendNext();
  }

  // 中文识别大模型 WebSocket 通信（v2/iat 标准协议）
  // 响应格式与方言大模型不同：code/data.result.ws 结构
  private sendAudioChineseModel(wsUrl: string, appId: string, audioBuffer: Buffer, timeoutMs: number = STT_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      // 中文大模型用 sn→text Map 处理 pgs=rpl（替换）场景
      const resultMap = new Map<number, string>();
      let isResolved = false;

      const resolveWithResults = (reason: string) => {
        if (isResolved) return;
        isResolved = true;
        // 按 sn 顺序拼接所有片段
        const finalTranscript = Array.from(resultMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, text]) => text)
          .join('');
        this.logger.log(`STT完成(中文大模型-${reason}): ${finalTranscript.length}字`);
        resolve(finalTranscript);
      };

      const timeout = setTimeout(() => {
        ws.close();
        if (resultMap.size > 0) resolveWithResults('timeout-partial');
        else reject(new Error(`STT超时(${timeoutMs / 1000}s)`));
      }, timeoutMs);

      ws.on('open', () => {
        this.logger.log(`STT开始(中文识别大模型): ${Math.ceil(audioBuffer.length / FRAME_SIZE)}帧`);
        this.sendFramesChinese(ws, appId, audioBuffer);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const resp = JSON.parse(data.toString());
          const code = resp.code ?? 0;

          if (code !== 0) {
            clearTimeout(timeout);
            ws.close();
            if (resultMap.size > 0) {
              this.logger.warn(`STT中文大模型 code ${code}，已有内容，使用部分结果`);
              resolveWithResults('error-partial');
            } else {
              reject(new Error(`STT错误: ${code} - ${resp.message ?? ''}`));
            }
            return;
          }

          // 解析 ws 词段，处理 pgs=rpl（替换之前的 sn）
          const result = resp.data?.result;
          if (result?.ws) {
            const text = (result.ws as Array<{ cw: Array<{ w: string }> }>)
              .map(w => w.cw.map(c => c.w).join(''))
              .join('');
            const sn: number = result.sn ?? 1;
            if (result.pgs === 'rpl' && result.rg) {
              // 替换 rg 范围内的已有片段
              const [start, end] = result.rg as [number, number];
              for (let i = start; i <= end; i++) resultMap.delete(i);
            }
            if (text) resultMap.set(sn, text);
          }

          // status=2 且 ls=true 表示识别结束
          if (resp.data?.status === 2) {
            clearTimeout(timeout);
            ws.close();
            resolveWithResults('complete');
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        if (resultMap.size > 0) resolveWithResults('error-partial');
        else reject(new Error(`WebSocket错误: ${error.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!isResolved && resultMap.size > 0) resolveWithResults('closed');
      });
    });
  }

  // 中文大模型帧发送：首帧带 common+business+data，后续帧只带 data
  private sendFramesChinese(ws: WebSocket, appId: string, audioBuffer: Buffer): void {
    const totalFrames = Math.ceil(audioBuffer.length / FRAME_SIZE);
    let frameIndex = 0;

    const sendNext = () => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const start = frameIndex * FRAME_SIZE;
      const end = Math.min(start + FRAME_SIZE, audioBuffer.length);
      const chunk = audioBuffer.subarray(start, end);
      const status = frameIndex === 0 ? 0 : frameIndex >= totalFrames - 1 ? 2 : 1;

      const audioPayload = {
        status,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: chunk.toString('base64'),
      };

      let message: any;
      if (frameIndex === 0) {
        message = {
          common:   { app_id: appId },
          business: {
            language: 'zh_cn',
            domain:   'iat',
            accent:   'mandarin',
            eos:      10000,   // 静音检测(ms)
            ptt:      1,       // 标点
            nunum:    1,       // 数字规整
          },
          data: audioPayload,
        };
      } else {
        message = { data: audioPayload };
      }

      ws.send(JSON.stringify(message));
      frameIndex++;
      if (status !== 2) setTimeout(sendNext, FRAME_INTERVAL);
    };

    sendNext();
  }
}
