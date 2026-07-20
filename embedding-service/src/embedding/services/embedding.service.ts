import { Injectable, OnModuleInit } from '@nestjs/common';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { AppLogger } from '../../common/logger/services/app-logger';

// Xenova's ONNX conversion of BAAI/bge-small-en-v1.5 — transformers.js requires
// ONNX weights, so it's pulled from this mirror rather than the original repo,
// but the reported model name stays the original one callers actually asked for.
const MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? 'Xenova/bge-small-en-v1.5';
const MODEL_NAME = 'BAAI/bge-small-en-v1.5';
const DIMENSIONS = 384;
const BATCH_SIZE = 32;

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

// Loaded once at boot and kept warm for the lifetime of the process — this
// service is stateless otherwise, so it scales horizontally by replica count.
@Injectable()
export class EmbeddingService implements OnModuleInit {
  private extractor!: FeatureExtractionPipeline;

  constructor(private readonly logger: AppLogger) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('EmbeddingService.onModuleInit: loading model', {
      modelId: MODEL_ID,
    });
    this.extractor = await pipeline('feature-extraction', MODEL_ID);
    this.logger.log('EmbeddingService.onModuleInit: model ready', {
      modelId: MODEL_ID,
    });
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const output = await this.extractor(batch, {
        pooling: 'mean',
        normalize: true,
      });
      embeddings.push(...(output.tolist() as number[][]));
    }
    return { embeddings, model: MODEL_NAME, dimensions: DIMENSIONS };
  }
}
