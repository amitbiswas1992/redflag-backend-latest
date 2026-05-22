import { IsNumber, IsObject, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ScoreTuningDto {
    @ApiProperty({ example: 1.0, minimum: 0.7, maximum: 1.3 }) @IsNumber() @Min(0) @Max(2) Scope!: number;
    @ApiProperty({ example: 1.0, minimum: 0.5, maximum: 1.5 }) @IsNumber() @Min(0) @Max(2) FinancialCost!: number;
    @ApiProperty({ example: 1.0, minimum: 0.5, maximum: 1.5 }) @IsNumber() @Min(0) @Max(2) BlastRadius!: number;
    @ApiProperty({ example: 1.0, minimum: 0.5, maximum: 1.5 }) @IsNumber() @Min(0) @Max(2) TemporalExposure!: number;
}

export class UpdateScoreTuningDto {
    @IsObject() @ValidateNested() @Type(() => ScoreTuningDto) scoreTuning!: ScoreTuningDto;
}
