import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Enums ────────────────────────────────────────────────────────────────────

export enum TargetTable {
    ENCOUNTER_ANALYTICS = 'encounter_analytics',
    MEDICATION_ANALYTICS = 'medication_analytics',
}

export enum Severity {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW',
}

export enum ConditionOperator {
    EQUALS = 'EQUALS',
    NOT_EQUALS = 'NOT_EQUALS',
    GREATER_THAN = 'GREATER_THAN',
    LESS_THAN = 'LESS_THAN',
    GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
    LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
    IS_NULL = 'IS_NULL',
    IS_NOT_NULL = 'IS_NOT_NULL',
    CONTAINS = 'CONTAINS',
    NOT_CONTAINS = 'NOT_CONTAINS',
    IN = 'IN',
    NOT_IN = 'NOT_IN',
}

export enum LogicalOperator {
    AND = 'AND',
    OR = 'OR',
}

// ── Category DTOs ─────────────────────────────────────────────────────────────

export class CreateRuleCategoryDto {
    @ApiProperty({ example: 'Telehealth' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ example: 'TH' })
    @IsString()
    @IsNotEmpty()
    prefix!: string;

    @ApiPropertyOptional({ example: 'Rules related to telehealth encounters' })
    @IsOptional()
    @IsString()
    description?: string;
}

export class UpdateRuleCategoryDto extends PartialType(CreateRuleCategoryDto) {}

// ── Condition DTOs ────────────────────────────────────────────────────────────

export class CreateRuleConditionDto {
    @ApiProperty({
        example: 'is_telehealth',
        description: 'snake_case column name in the target analytics table',
    })
    @IsString()
    @IsNotEmpty()
    fieldName: string;

    @ApiProperty({ enum: ConditionOperator, example: ConditionOperator.EQUALS })
    @IsEnum(ConditionOperator)
    operator: ConditionOperator;

    @ApiPropertyOptional({
        example: 'true',
        description: 'Threshold value stored as text. Not needed for IS_NULL / IS_NOT_NULL.',
    })
    @IsOptional()
    @IsString()
    value?: string;

    @ApiProperty({
        enum: LogicalOperator,
        example: LogicalOperator.AND,
        description: 'How this condition chains with the NEXT condition',
    })
    @IsEnum(LogicalOperator)
    logicalOperator: LogicalOperator;

    @ApiProperty({ example: 0, description: 'Zero-based ordering of conditions' })
    @IsInt()
    @Min(0)
    order: number;
}

// ── Rule DTOs ─────────────────────────────────────────────────────────────────

export class CreateRiskRuleDto {
    @ApiPropertyOptional({
        description: 'UUID of the parent finding category',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiProperty({ example: 'Ryan Haight Act Violation' })
    @IsString()
    @IsNotEmpty()
    ruleName: string;

    @ApiPropertyOptional({ example: 'TH-001' })
    @IsOptional()
    @IsString()
    ruleCode?: string;

    @ApiProperty({
        enum: TargetTable,
        example: TargetTable.ENCOUNTER_ANALYTICS,
        description: 'Which analytics projection table this rule queries',
    })
    @IsIn(Object.values(TargetTable))
    targetTable: TargetTable;

    @ApiProperty({ enum: Severity, example: Severity.HIGH })
    @IsEnum(Severity)
    severity: Severity;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Override auto-generated serial within the category', example: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    serial?: number;

    @ApiProperty({
        type: [CreateRuleConditionDto],
        description: 'At least one condition is required',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateRuleConditionDto)
    conditions: CreateRuleConditionDto[];
}

export class UpdateRiskRuleDto extends PartialType(CreateRiskRuleDto) {}

// ── Flag DTOs ─────────────────────────────────────────────────────────────────

export class UpdateFlagDto {
    @ApiPropertyOptional({
        description:
            'Per-factor score overrides. A null value for a key means "use archetype value". ' +
            'Keys: Scope | Encounter | FinancialCost | BlastRadius | PatientHarm | TemporalExposure',
        example: { Scope: 8, Encounter: null, FinancialCost: 7 },
    })
    @IsOptional()
    scoreFactorsOverride?: Record<string, number | null> | null;
}
