// DashScope Vocabulary API Service - Query and update hotword vocabulary
// v1.1 - Fixed model name: vocabulary management uses "speech-biasing", not "paraformer-v2"

import { Injectable, Logger } from '@nestjs/common';

// DashScope customization endpoint (single URL, action-based)
const DASHSCOPE_CUSTOMIZATION_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/customization';

export interface VocabularyWord {
  text: string;
  weight: number;
}

interface CustomizationResponse {
  request_id: string;
  code?: string;
  message?: string;
  output?: {
    vocabulary_id?: string;
    vocabulary?: VocabularyWord[];
    // update response fields
    status?: string;
  };
}

@Injectable()
export class DashScopeVocabularyService {
  private readonly logger = new Logger(DashScopeVocabularyService.name);

  private getApiKey(): string {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) throw new Error('DASHSCOPE_NOT_CONFIGURED: DashScope API Key 未配置');
    return key;
  }

  private getVocabularyId(): string {
    const id = process.env.DASHSCOPE_VOCABULARY_ID;
    if (!id) throw new Error('DASHSCOPE_VOCABULARY_NOT_CONFIGURED: DASHSCOPE_VOCABULARY_ID 未配置');
    return id;
  }

  /**
   * Query current vocabulary content from DashScope
   */
  async queryVocabulary(): Promise<VocabularyWord[]> {
    const apiKey = this.getApiKey();
    const vocabularyId = this.getVocabularyId();

    this.logger.log(`Querying DashScope vocabulary: ${vocabularyId}`);

    const response = await fetch(DASHSCOPE_CUSTOMIZATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'speech-biasing',
        input: {
          action: 'query_vocabulary',
          vocabulary_id: vocabularyId,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`DashScope query_vocabulary failed: ${response.status} - ${errorText.slice(0, 300)}`);
      throw new Error(`DASHSCOPE_QUERY_ERROR: ${response.status}`);
    }

    const data: CustomizationResponse = await response.json();
    if (data.code) {
      throw new Error(`DASHSCOPE_QUERY_ERROR: [${data.code}] ${data.message}`);
    }

    const words = data.output?.vocabulary || [];
    this.logger.log(`Vocabulary query returned ${words.length} words`);
    return words;
  }

  /**
   * Update (full replace) vocabulary on DashScope
   * This replaces all words in the vocabulary with the provided list
   */
  async updateVocabulary(words: VocabularyWord[]): Promise<{ vocabularyId: string; wordCount: number }> {
    const apiKey = this.getApiKey();
    const vocabularyId = this.getVocabularyId();

    if (words.length > 500) {
      throw new Error(`VOCABULARY_LIMIT: 热词数量 ${words.length} 超过上限 500`);
    }

    this.logger.log(`Updating DashScope vocabulary ${vocabularyId} with ${words.length} words`);

    const response = await fetch(DASHSCOPE_CUSTOMIZATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'speech-biasing',
        input: {
          action: 'update_vocabulary',
          vocabulary_id: vocabularyId,
          vocabulary: words,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`DashScope update_vocabulary failed: ${response.status} - ${errorText.slice(0, 300)}`);
      throw new Error(`DASHSCOPE_UPDATE_ERROR: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data: CustomizationResponse = await response.json();
    if (data.code) {
      throw new Error(`DASHSCOPE_UPDATE_ERROR: [${data.code}] ${data.message}`);
    }

    this.logger.log(`Vocabulary updated successfully: ${vocabularyId}, ${words.length} words`);
    return { vocabularyId, wordCount: words.length };
  }
}
