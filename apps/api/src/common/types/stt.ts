// STT model tracking types
// Used across audio, meeting, and feedback modules to record which STT engine processed each recording

export type SttModel = 'dashscope_paraformer_v2' | 'xunfei_dialect_slm' | 'xunfei_chinese_iat';

export type DiarizationStatus = 'success' | 'single_speaker' | 'unavailable';

export interface SttResult {
  transcript: string;
  sttModel: SttModel;
  diarizationStatus: DiarizationStatus;
}
