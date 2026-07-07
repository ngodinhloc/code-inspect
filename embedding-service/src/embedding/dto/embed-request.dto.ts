import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

const MAX_TEXTS_PER_REQUEST = 256;

export class EmbedRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TEXTS_PER_REQUEST)
  @IsString({ each: true })
  texts!: string[];
}
