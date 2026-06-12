import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsUUID } from 'class-validator';

export class UpdateNotificationStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty()
  @IsBoolean()
  isRead!: boolean;
}
