import { IsString, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  question!: string;
}
