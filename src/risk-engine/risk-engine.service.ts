import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../server/prisma.service';
import {
  CreateRiskRuleDto,
  UpdateRiskRuleDto,
  EventName,
  Operator,
} from './dto/risk-engine.dto';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(private prisma: PrismaService) {}

  // Risk Rule CRUD Operations
  async createRule(createRuleDto: CreateRiskRuleDto) {
    try {
      const rule = await this.prisma.riskRule.create({
        data: {
          roleName: createRuleDto.roleName,
          riskLevel: createRuleDto.riskLevel,
          eventName: createRuleDto.eventName,
          field: createRuleDto.field,
          operator: createRuleDto.operator,
          value: createRuleDto.value,
          score: createRuleDto.score,
          isActive: createRuleDto.isActive ?? true,
        },
      });

      this.logger.log(`Created risk rule: ${rule.id} - ${rule.roleName}`);
      return rule;
    } catch (error) {
      this.logger.error(
        `Error creating risk rule: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to create risk rule');
    }
  }

  async findAllRules(isActive?: boolean) {
    const where = isActive !== undefined ? { isActive } : {};
    return this.prisma.riskRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleById(id: string) {
    const rule = await this.prisma.riskRule.findUnique({
      where: { id },
      include: {
        evaluations: {
          take: 10,
          orderBy: { evaluatedAt: 'desc' },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(`Risk rule with ID ${id} not found`);
    }

    return rule;
  }

  async findRulesByEventName(eventName: EventName, isActive?: boolean) {
    const where: any = { eventName };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.riskRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(id: string, updateRuleDto: UpdateRiskRuleDto) {
    const existingRule = await this.prisma.riskRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      throw new NotFoundException(`Risk rule with ID ${id} not found`);
    }

    try {
      const rule = await this.prisma.riskRule.update({
        where: { id },
        data: updateRuleDto,
      });

      this.logger.log(`Updated risk rule: ${rule.id} - ${rule.roleName}`);
      return rule;
    } catch (error) {
      this.logger.error(
        `Error updating risk rule: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to update risk rule');
    }
  }

  async deleteRule(id: string) {
    const existingRule = await this.prisma.riskRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      throw new NotFoundException(`Risk rule with ID ${id} not found`);
    }

    await this.prisma.riskRule.delete({
      where: { id },
    });

    this.logger.log(`Deleted risk rule: ${id}`);
    return { message: 'Risk rule deleted successfully' };
  }

  // Rule Evaluation Engine
  async evaluatePatientRules(patientId: string) {
    this.logger.log(`Evaluating rules for patient: ${patientId}`);

    // Get all active rules
    const rules = await this.prisma.riskRule.findMany({
      where: { isActive: true },
    });

    if (rules.length === 0) {
      this.logger.warn('No active rules found for evaluation');
      return {
        patientId,
        totalScore: 0,
        matchedRulesCount: 0,
        highestRiskLevel: null,
        evaluations: [],
        lastEvaluatedAt: new Date(),
      };
    }

    // Get patient data
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const evaluations: any[] = [];
    let totalScore = 0;
    const riskLevels = new Set<string>();

    // Evaluate each rule
    for (const rule of rules) {
      const evaluation = await this.evaluateRule(rule, patient);
      evaluations.push(evaluation);

      if (evaluation.matched) {
        totalScore += evaluation.score;
        riskLevels.add(rule.riskLevel);
      }
    }

    // Determine highest risk level
    const riskLevelOrder = ['critical', 'high', 'medium', 'low'];
    const highestRiskLevel =
      riskLevels.size > 0
        ? riskLevelOrder.find((level) => riskLevels.has(level)) || 'low'
        : null;

    this.logger.log(
      `Evaluation complete for patient ${patientId}: ${evaluations.filter((e) => e.matched).length} rules matched, total score: ${totalScore}`,
    );

    return {
      patientId,
      totalScore,
      matchedRulesCount: evaluations.filter((e) => e.matched).length,
      highestRiskLevel,
      evaluations,
      lastEvaluatedAt: new Date(),
    };
  }

  private async evaluateRule(rule: any, patient: any) {
    let matched = false;
    let matchedValue: string | null = null;
    let eventId: string | null = null;

    try {
      // Get data based on event name
      const eventData = this.getEventData(rule.eventName, patient);

      // Evaluate each record in the event data
      for (const record of eventData) {
        const fieldValue = this.getFieldValue(record, rule.field);

        if (fieldValue !== null && fieldValue !== undefined) {
          if (this.compareValues(fieldValue, rule.operator, rule.value)) {
            matched = true;
            matchedValue = String(fieldValue);
            eventId = record.id || record.epicId || null;
            break; // Match found, no need to check other records
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error evaluating rule ${rule.id}: ${error.message}`,
        error.stack,
      );
    }

    // Save evaluation result
    const evaluation = await this.prisma.riskEvaluation.create({
      data: {
        patientId: patient.id,
        ruleId: rule.id,
        matched,
        matchedValue,
        score: matched ? rule.score : 0,
        eventType: rule.eventName,
        eventId,
      },
      include: {
        rule: true,
      },
    });

    return evaluation;
  }

  private getEventData(eventName: EventName, patient: any): any[] {
    switch (eventName) {
      case EventName.OBSERVATION:
        return patient.observations || [];
      case EventName.CONDITION:
        return patient.conditions || [];
      case EventName.ALLERGY:
        return patient.allergies || [];
      case EventName.MEDICATION:
        return patient.medications || [];
      case EventName.PROCEDURE:
        return patient.procedures || [];
      case EventName.ENCOUNTER:
        return patient.encounters || [];
      case EventName.DIAGNOSTIC_REPORT:
        return patient.diagnosticReports || [];
      default:
        return [];
    }
  }

  private getFieldValue(record: any, field: string): any {
    // Support nested field access (e.g., "patient.name")
    const fields = field.split('.');
    let value = record;

    for (const f of fields) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[f];
    }

    return value;
  }

  private compareValues(
    actualValue: any,
    operator: Operator,
    expectedValue: string,
  ): boolean {
    const actualStr = String(actualValue).toLowerCase();
    const expectedStr = String(expectedValue).toLowerCase();

    // Try to parse as numbers for numeric comparisons
    const actualNum = parseFloat(actualStr);
    const expectedNum = parseFloat(expectedStr);
    const isNumeric = !isNaN(actualNum) && !isNaN(expectedNum);

    switch (operator) {
      case Operator.EQUALS:
        return actualStr === expectedStr;
      case Operator.NOT_EQUALS:
        return actualStr !== expectedStr;
      case Operator.LESS_THAN:
        return isNumeric ? actualNum < expectedNum : actualStr < expectedStr;
      case Operator.GREATER_THAN:
        return isNumeric ? actualNum > expectedNum : actualStr > expectedStr;
      case Operator.LESS_THAN_OR_EQUAL:
        return isNumeric ? actualNum <= expectedNum : actualStr <= expectedStr;
      case Operator.GREATER_THAN_OR_EQUAL:
        return isNumeric ? actualNum >= expectedNum : actualStr >= expectedStr;
      case Operator.CONTAINS:
        return actualStr.includes(expectedStr);
      case Operator.STARTS_WITH:
        return actualStr.startsWith(expectedStr);
      case Operator.ENDS_WITH:
        return actualStr.endsWith(expectedStr);
      default:
        return false;
    }
  }

  // Get patient risk summary
  async getPatientRiskSummary(patientId: string) {
    const evaluations = await this.prisma.riskEvaluation.findMany({
      where: { patientId },
      include: {
        rule: true,
      },
      orderBy: { evaluatedAt: 'desc' },
    });

    const matchedEvaluations = evaluations.filter((e) => e.matched);
    const totalScore = matchedEvaluations.reduce(
      (sum, e) => sum + e.score,
      0,
    );

    const riskLevels = new Set(
      matchedEvaluations.map((e) => e.rule.riskLevel),
    );
    const riskLevelOrder = ['critical', 'high', 'medium', 'low'];
    const highestRiskLevel =
      riskLevels.size > 0
        ? riskLevelOrder.find((level) => riskLevels.has(level)) || 'low'
        : null;

    return {
      patientId,
      totalScore,
      matchedRulesCount: matchedEvaluations.length,
      highestRiskLevel,
      evaluations: matchedEvaluations,
      lastEvaluatedAt:
        evaluations.length > 0 ? evaluations[0].evaluatedAt : null,
    };
  }

  // Get evaluation history for a patient
  async getPatientEvaluationHistory(patientId: string, limit = 50) {
    return this.prisma.riskEvaluation.findMany({
      where: { patientId },
      include: {
        rule: true,
      },
      orderBy: { evaluatedAt: 'desc' },
      take: limit,
    });
  }
}

