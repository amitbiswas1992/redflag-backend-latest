import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export enum PlanStatus {
    IN_PROGRESS = 'in_progress',
    PENDING_VALIDATION = 'pending_validation',
    COMPLETED = 'completed',
    NEED_MORE_INFO = 'need_more_info',
    QUERY_ANSWERED = 'query_answered',
}

export enum RootCauseType {
    WORKFLOW_GAP = 'workflow-gap',
    TRAINING_ISSUE = 'training-issue',
    SYSTEM_LIMITATION = 'system-limitation',
    RESOURCE_CONSTRAINT = 'resource-constraint',
}

export enum RiskManagementPlanType {
    MITIGATE = 'mitigate',
    ACCEPT = 'accept',
    RISK_TRANSFER = 'risk-transfer',
}

export class CreateRiskManagementPlanDto {
    @ApiProperty({ example: 'Telehealth Prescribing Compliance Plan' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
    @IsDateString()
    dueDate: string;

    @ApiProperty({ enum: RiskManagementPlanType, default: RiskManagementPlanType.MITIGATE })
    @IsOptional()
    @IsEnum(RiskManagementPlanType)
    type?: RiskManagementPlanType;

    @ApiProperty({ enum: RootCauseType })
    @IsEnum(RootCauseType)
    rootCauseType: RootCauseType;

    @ApiProperty({ example: 'Patients are being prescribed controlled substances without in-person evaluation.' })
    @IsString()
    @IsNotEmpty()
    impactAnalysis: string;

    @ApiProperty({ example: 'Implementing mandatory in-person visit requirement before telehealth prescriptions.' })
    @IsString()
    @IsNotEmpty()
    justification: string;

    @ApiPropertyOptional({ type: [String], description: 'UUIDs of compliance flags to link' })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    complianceFlagIds?: string[];

    @ApiPropertyOptional({ description: 'UUID of the risk rule this plan addresses (nullable)' })
    @IsOptional()
    @IsUUID()
    riskRuleId?: string;

    @ApiPropertyOptional({ type: [String], description: 'UUIDs of users assigned to this plan' })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    assigneeIds?: string[];
}

export class UpdateRiskManagementPlanDto extends PartialType(CreateRiskManagementPlanDto) {}

export class CreateRiskManagementPlanMessageDto {
    @ApiProperty({ example: 'Can you clarify the impact on outpatient encounters?' })
    @IsString()
    @IsNotEmpty()
    text: string;
}

export class UpdateRiskManagementPlanStatusDto {
    @ApiProperty({ enum: PlanStatus })
    @IsEnum(PlanStatus)
    status: PlanStatus;
}
