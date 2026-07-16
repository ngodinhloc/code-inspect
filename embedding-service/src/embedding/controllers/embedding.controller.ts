import { Body, Controller, Post } from '@nestjs/common';
import {
  EmbeddingService,
  EmbeddingResult,
} from '../services/embedding.service';
import { EmbedRequestDto } from '../dto/embed-request.dto';

@Controller('api')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('embed')
  embed(@Body() dto: EmbedRequestDto): Promise<EmbeddingResult> {
    return this.embeddingService.embed(dto.texts);
  }
}
