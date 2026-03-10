import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
}

export enum ConditionLogic {
  AND = 'AND',
  OR = 'OR',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class RuleConditionDto {
  @ApiProperty({
    description: 'Fully-qualified field name to check (e.g. "Model.fieldName")',
    example: 'Medication.controlledSubstancePrescribed',
  })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: Operator,
    example: Operator.EQUALS,
  })
  @IsEnum(Operator)
  @IsNotEmpty()
  operator: Operator;

  @ApiPropertyOptional({
    description: 'Comparison value (not required for IS_NULL/IS_NOT_NULL)',
    example: '1',
  })
  @IsString()
  @IsOptional()
  value?: string;
}

export class CreateRiskRuleDto {
  @ApiProperty({
    description: 'Name of the risk rule',
    example: 'Ryan Haight Act Violation',
  })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiPropertyOptional({
    description: 'Rule code (e.g., "TH-001")',
    example: 'TH-001',
  })
  @IsString()
  @IsOptional()
  ruleCode?: string;

  @ApiProperty({
    description: 'Risk level',
    enum: RiskLevel,
    example: RiskLevel.CRITICAL,
  })
  @IsEnum(RiskLevel)
  @IsNotEmpty()
  riskLevel: RiskLevel;

  @ApiPropertyOptional({
    description: 'Event/activity type to monitor (optional for multi-condition rules)',
    enum: EventName,
    example: EventName.MEDICATION,
  })
  @IsEnum(EventName)
  @IsOptional()
  eventName?: EventName;

  @ApiProperty({
    description: 'Array of conditions for the rule',
    type: [RuleConditionDto],
    example: [
      {
        field: 'Medication.controlledSubstancePrescribed',
        operator: Operator.EQUALS,
        value: '1',
      },
      {
        field: 'Encounter.patientIdentityVerified',
        operator: Operator.IS_NULL,
      },
      {
        field: 'Encounter.telehealthId',
        operator: Operator.IS_NOT_NULL,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiPropertyOptional({
    description: 'Logic to combine conditions (AND or OR)',
    enum: ConditionLogic,
    default: ConditionLogic.AND,
    example: ConditionLogic.AND,
  })
  @IsEnum(ConditionLogic)
  @IsOptional()
  conditionLogic?: ConditionLogic;

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

  @ApiProperty({
    description: 'List of affected variables',
    type: [String],
    example: [
      'Medication.controlledSubstancePrescribed',
      'Encounter.patientIdentityVerified',
      'Encounter.telehealthId',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  affectedVariables: string[];

  @ApiPropertyOptional({
    description: 'Taxonomy classification',
    example: 'HSCR2: Regulatory Risk → HSCR3: Federal DEA Compliance Violation',
  })
  @IsString()
  @IsOptional()
  taxonomy?: string;

  @ApiPropertyOptional({
    description: 'Regulatory citation',
    example: '21 USC § 829(e) - Ryan Haight Online Pharmacy Consumer Protection Act',
  })
  @IsString()
  @IsOptional()
  regulatoryCitation?: string;

  @ApiPropertyOptional({
    description: 'Array of red flag descriptions',
    type: [String],
    example: [
      'Telehealth controlled substance prescriptions without identity verification',
      'No valid patient-practitioner relationship established',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  redFlags?: string[];

  @ApiPropertyOptional({
    description: 'Whether the rule is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Legacy fields for backward compatibility (deprecated)
  @ApiPropertyOptional({
    description: 'Field name to check (deprecated - use conditions instead)',
    example: 'value',
  })
  @IsString()
  @IsOptional()
  field?: string;

  @ApiPropertyOptional({
    description: 'Comparison operator (deprecated - use conditions instead)',
    enum: Operator,
    example: Operator.GREATER_THAN,
  })
  @IsEnum(Operator)
  @IsOptional()
  operator?: Operator;

  @ApiPropertyOptional({
    description: 'Comparison value (deprecated - use conditions instead)',
    example: '140',
  })
  @IsString()
  @IsOptional()
  value?: string;
}

export class UpdateRiskRuleDto {
  @ApiPropertyOptional({
    description: 'Name of the risk rule',
    example: 'Ryan Haight Act Violation',
  })
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiPropertyOptional({
    description: 'Rule code (e.g., "TH-001")',
    example: 'TH-001',
  })
  @IsString()
  @IsOptional()
  ruleCode?: string;

  @ApiPropertyOptional({
    description: 'Risk level',
    enum: RiskLevel,
    example: RiskLevel.CRITICAL,
  })
  @IsEnum(RiskLevel)
  @IsOptional()
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Event/activity type to monitor (optional for multi-condition rules)',
    enum: EventName,
    example: EventName.MEDICATION,
  })
  @IsEnum(EventName)
  @IsOptional()
  eventName?: EventName;

  @ApiPropertyOptional({
    description: 'Array of conditions for the rule',
    type: [RuleConditionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  @IsOptional()
  conditions?: RuleConditionDto[];

  @ApiPropertyOptional({
    description: 'Logic to combine conditions (AND or OR)',
    enum: ConditionLogic,
    example: ConditionLogic.AND,
  })
  @IsEnum(ConditionLogic)
  @IsOptional()
  conditionLogic?: ConditionLogic;

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
    description: 'List of affected variables',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  affectedVariables?: string[];

  @ApiPropertyOptional({
    description: 'Taxonomy classification',
    example: 'HSCR2: Regulatory Risk → HSCR3: Federal DEA Compliance Violation',
  })
  @IsString()
  @IsOptional()
  taxonomy?: string;

  @ApiPropertyOptional({
    description: 'Regulatory citation',
    example: '21 USC § 829(e) - Ryan Haight Online Pharmacy Consumer Protection Act',
  })
  @IsString()
  @IsOptional()
  regulatoryCitation?: string;

  @ApiPropertyOptional({
    description: 'Array of red flag descriptions',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  redFlags?: string[];

  @ApiPropertyOptional({
    description: 'Whether the rule is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Legacy fields for backward compatibility (deprecated)
  @ApiPropertyOptional({
    description: 'Field name to check (deprecated - use conditions instead)',
    example: 'value',
  })
  @IsString()
  @IsOptional()
  field?: string;

  @ApiPropertyOptional({
    description: 'Comparison operator (deprecated - use conditions instead)',
    enum: Operator,
    example: Operator.GREATER_THAN,
  })
  @IsEnum(Operator)
  @IsOptional()
  operator?: Operator;

  @ApiPropertyOptional({
    description: 'Comparison value (deprecated - use conditions instead)',
    example: '140',
  })
  @IsString()
  @IsOptional()
  value?: string;
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
    ruleCode?: string;
    riskLevel: string;
    eventName?: string;
    score: number;
    conditionLogic?: string;
    affectedVariables?: string[];
    taxonomy?: string;
    regulatoryCitation?: string;
    redFlags?: string[];
    conditions?: RuleConditionDto[];
    // Legacy fields
    field?: string;
    operator?: string;
    value?: string;
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

export class RiskFieldNameDto {
  @ApiProperty({
    description: 'Logical table/model name where the field lives (Prisma model / event type)',
    example: 'Encounter',
  })
  table: string;

  @ApiProperty({
    description: 'Field name as used in Prisma/risk evaluation',
    example: 'practitionerName',
  })
  field: string;

  @ApiProperty({
    description: 'Fully-qualified field name with table prefix',
    example: 'Encounter.practitionerName',
  })
  fullName: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable description of the field',
    example: 'Display name of the practitioner for this encounter',
  })
  description?: string;
}

