import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EventName {
  OBSERVATION = 'Observation',
  CONDITION = 'Condition',
  ALLERGY = 'Allergy',
  MEDICATION = 'Medication',
  PROCEDURE = 'Procedure',
  ENCOUNTER = 'Encounter',
  DIAGNOSTIC_REPORT = 'DiagnosticReport',
}

export enum Operator {
  EQUALS = '=',
  NOT_EQUALS = '!=',
  LESS_THAN = '<',
  GREATER_THAN = '>',
  LESS_THAN_OR_EQUAL = '<=',
  GREATER_THAN_OR_EQUAL = '>=',
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class CreateRiskRuleDto {
  @ApiProperty({
    description: 'Name of the risk rule',
    example: 'High Blood Pressure Alert',
  })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiProperty({
    description: 'Risk level',
    enum: RiskLevel,
    example: RiskLevel.HIGH,
  })
  @IsEnum(RiskLevel)
  @IsNotEmpty()
  riskLevel: RiskLevel;

  @ApiProperty({
    description: 'Event/activity type to monitor',
    enum: EventName,
    example: EventName.OBSERVATION,
  })
  @IsEnum(EventName)
  @IsNotEmpty()
  eventName: EventName;

  @ApiProperty({
    description: 'Field name to check in the event data',
    example: 'value',
  })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: Operator,
    example: Operator.GREATER_THAN,
  })
  @IsEnum(Operator)
  @IsNotEmpty()
  operator: Operator;

  @ApiProperty({
    description: 'Comparison value',
    example: '140',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({
    description: 'Score/points assigned when rule matches',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional({
    description: 'Whether the rule is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRiskRuleDto {
  @ApiPropertyOptional({
    description: 'Name of the risk rule',
    example: 'High Blood Pressure Alert',
  })
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiPropertyOptional({
    description: 'Risk level',
    enum: RiskLevel,
    example: RiskLevel.HIGH,
  })
  @IsEnum(RiskLevel)
  @IsOptional()
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Event/activity type to monitor',
    enum: EventName,
    example: EventName.OBSERVATION,
  })
  @IsEnum(EventName)
  @IsOptional()
  eventName?: EventName;

  @ApiPropertyOptional({
    description: 'Field name to check in the event data',
    example: 'value',
  })
  @IsString()
  @IsOptional()
  field?: string;

  @ApiPropertyOptional({
    description: 'Comparison operator',
    enum: Operator,
    example: Operator.GREATER_THAN,
  })
  @IsEnum(Operator)
  @IsOptional()
  operator?: Operator;

  @ApiPropertyOptional({
    description: 'Comparison value',
    example: '140',
  })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiPropertyOptional({
    description: 'Score/points assigned when rule matches',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({
    description: 'Whether the rule is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RiskEvaluationResultDto {
  @ApiProperty({ description: 'Evaluation ID' })
  id: string;

  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiProperty({ description: 'Rule ID' })
  ruleId: string;

  @ApiProperty({ description: 'Whether the rule matched' })
  matched: boolean;

  @ApiPropertyOptional({ description: 'The actual value that matched' })
  matchedValue?: string;

  @ApiProperty({ description: 'Score from the rule' })
  score: number;

  @ApiProperty({ description: 'Evaluation timestamp' })
  evaluatedAt: Date;

  @ApiProperty({ description: 'Type of event that triggered evaluation' })
  eventType: string;

  @ApiPropertyOptional({ description: 'ID of the specific event that matched' })
  eventId?: string;

  @ApiProperty({ description: 'Rule details' })
  rule: {
    id: string;
    roleName: string;
    riskLevel: string;
    eventName: string;
    field: string;
    operator: string;
    value: string;
    score: number;
  };
}

export class PatientRiskSummaryDto {
  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiProperty({ description: 'Total risk score' })
  totalScore: number;

  @ApiProperty({ description: 'Number of matched rules' })
  matchedRulesCount: number;

  @ApiProperty({ description: 'Highest risk level' })
  highestRiskLevel: string;

  @ApiProperty({ description: 'Evaluation results' })
  evaluations: RiskEvaluationResultDto[];

  @ApiProperty({ description: 'Last evaluation timestamp' })
  lastEvaluatedAt: Date;
}

