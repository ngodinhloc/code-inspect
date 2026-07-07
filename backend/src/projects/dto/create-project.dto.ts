import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  repositoryUrl!: string;

  @IsOptional()
  @IsString()
  branch?: string;
}
