// 讯飞 Speech-to-Text Service (WebSocket版本)
// v1.4 - 精简日志输出，减少冗余信息

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as WebSocket from 'ws';

const execAsync = promisify(exec);

// 讯飞 API Configuration
const XUNFEI_WSS_URL = 'wss://iat-api.xfyun.cn/v2/iat';
const FRAME_SIZE = 1280;
const FRAME_INTERVAL = 40;
const STT_TIMEOUT_MS = 60000;

interface XunfeiResponse {
  code: number;
  message: string;
  sid: string;
  data?: {
    status: number;
    result?: {
      ws: Array<{
        cw: Array<{ w: string }>;
      }>;
    };
  };
}

@Injectable()
export class XunfeiSttService {
  private readonly logger = new Logger(XunfeiSttService.name);

  async transcribe(audioUrl: string): Promise<string> {
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

    // Step 3: Send to 讯飞 STT
    const wsUrl = this.buildAuthUrl(apiKey, apiSecret);
    const transcript = await this.sendAudioAndGetTranscript(wsUrl, appId, pcmBuffer);

    return transcript;
  }

  private detectAudioFormat(url: string, buffer: Buffer): string {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.webm')) return 'webm';
    if (urlLower.includes('.wav')) return 'wav';
    if (urlLower.includes('.mp3')) return 'mp3';
    if (urlLower.includes('.ogg')) return 'ogg';
    if (urlLower.includes('.pcm')) return 'pcm';

    if (buffer.length >= 4) {
      if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm';
      if (buffer.toString('ascii', 0, 4) === 'RIFF') return 'wav';
      if ((buffer[0] === 0xff && buffer[1] === 0xfb) || buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
      if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
    }
    return 'webm';
  }

  private async downloadAudio(url: string): Promise<Buffer> {
    const response = await fetch(url);
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

  private buildAuthUrl(apiKey: string, apiSecret: string): string {
    const host = 'iat-api.xfyun.cn';
    const urlPath = '/v2/iat';
    const date = new Date().toUTCString();

    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${urlPath} HTTP/1.1`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    const params = new URLSearchParams({ authorization, date, host });
    return `${XUNFEI_WSS_URL}?${params.toString()}`;
  }

  private sendAudioAndGetTranscript(wsUrl: string, appId: string, audioBuffer: Buffer): Promise<string> {
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
          reject(new Error(`STT超时(${STT_TIMEOUT_MS / 1000}s)`));
        }
      }, STT_TIMEOUT_MS);

      ws.on('open', () => {
        this.logger.log(`STT开始: ${totalFrames}帧`);
        this.sendFrames(ws, appId, audioBuffer, frameIndex, totalFrames);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const response: XunfeiResponse = JSON.parse(data.toString());

          if (response.code !== 0) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`STT错误: ${response.code}`));
            return;
          }

          if (response.data?.result?.ws) {
            for (const word of response.data.result.ws) {
              for (const cw of word.cw) {
                if (cw.w) transcriptParts.push(cw.w);
              }
            }
          }

          if (response.data?.status === 2) {
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

      const message = {
        common: { app_id: appId },
        business: {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',
          vad_eos: 3000,
          dwa: 'wpgs',
          ptt: 0,
        },
        data: {
          status,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: chunk.toString('base64'),
        },
      };

      if (frameIndex > 0) {
        delete (message as any).common;
        delete (message as any).business;
      }

      ws.send(JSON.stringify(message));
      frameIndex++;

      if (status !== 2) {
        setTimeout(sendNext, FRAME_INTERVAL);
      }
    };

    sendNext();
  }
}
