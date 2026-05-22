import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Score Factors ─────────────────────────────────────────────────────────────

export class ScoreFactorsDto {
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) S: number;
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) E: number;
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) F: number;
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) B: number;
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) H: number;
    @ApiProperty({ example: 5, minimum: 0, maximum: 10 }) @IsNumber() @Min(0) @Max(10) T: number;
}

// ── Applicable Theory ─────────────────────────────────────────────────────────

export class ApplicableTheoryDto {
    @ApiProperty({ example: '21 U.S.C. § 829' })
    @IsString()
    @IsNotEmpty()
    law_ref: string;

    @ApiProperty({ example: 'No controlled substance may be prescribed without a valid prescription.' })
    @IsString()
    @IsNotEmpty()
    relevant_sentence: string;

    @ApiProperty({ example: 'Provider issued a controlled substance prescription without a valid patient relationship.' })
    @IsString()
    @IsNotEmpty()
    explanation: string;
}

// ── Create / Update DTOs ──────────────────────────────────────────────────────

export class CreateFindingArchetypeDto {
    @ApiPropertyOptional({ description: 'Rule this archetype is derived from' })
    @IsOptional()
    @IsUUID()
    ruleId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    severityRationale?: string;

    @ApiPropertyOptional({ type: [ApplicableTheoryDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ApplicableTheoryDto)
    applicableTheories?: ApplicableTheoryDto[];

    @ApiPropertyOptional({ description: 'Parent archetype UUID for hierarchical trees' })
    @IsOptional()
    @IsUUID()
    parentId?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    @Min(0)
    serial?: number;

    @ApiPropertyOptional({ example: 'TH-001-A', description: 'Human-readable unique catalog identifier' })
    @IsOptional()
    @IsString()
    catalogId?: string;

    @ApiPropertyOptional({ type: ScoreFactorsDto })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ScoreFactorsDto)
    scoreFactors?: ScoreFactorsDto;
}

export class UpdateFindingArchetypeDto extends PartialType(CreateFindingArchetypeDto) {}

// ── List Query ────────────────────────────────────────────────────────────────

export class ListFindingArchetypesQuery {
    @ApiPropertyOptional() @IsOptional() @IsUUID() ruleId?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() catalogId?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
