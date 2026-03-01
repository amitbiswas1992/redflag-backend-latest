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
  ConditionLogic,
} from './dto/risk-engine.dto';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(private prisma: PrismaService) {}

  // Risk Rule CRUD Operations
  async createRule(createRuleDto: CreateRiskRuleDto) {
    try {
      // Support both new multi-condition format and legacy single condition format
      const hasConditions = createRuleDto.conditions && createRuleDto.conditions.length > 0;
      const hasLegacyFields = createRuleDto.field && createRuleDto.operator;

      if (!hasConditions && !hasLegacyFields) {
        throw new BadRequestException(
          'Either conditions array or legacy field/operator/value must be provided',
        );
      }

      // Create the rule
      const rule = await this.prisma.riskRule.create({
        data: {
          roleName: createRuleDto.roleName,
          ruleCode: createRuleDto.ruleCode,
          riskLevel: createRuleDto.riskLevel,
          eventName: createRuleDto.eventName || null,
          score: createRuleDto.score,
          conditionLogic: createRuleDto.conditionLogic || ConditionLogic.AND,
          affectedVariables: createRuleDto.affectedVariables || [],
          taxonomy: createRuleDto.taxonomy,
          regulatoryCitation: createRuleDto.regulatoryCitation,
          redFlags: createRuleDto.redFlags || [],
          isActive: createRuleDto.isActive ?? true,
          // Legacy fields for backward compatibility
          field: createRuleDto.field,
          operator: createRuleDto.operator,
          value: createRuleDto.value,
          conditions: hasConditions
            ? {
                create: createRuleDto.conditions.map((condition, index) => ({
                  field: condition.field,
                  operator: condition.operator,
                  value: condition.value || null,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          conditions: {
            orderBy: { order: 'asc' },
          },
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
      include: {
        conditions: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleById(id: string) {
    const rule = await this.prisma.riskRule.findUnique({
      where: { id },
      include: {
        conditions: {
          orderBy: { order: 'asc' },
        },
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
      include: {
        conditions: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(id: string, updateRuleDto: UpdateRiskRuleDto) {
    const existingRule = await this.prisma.riskRule.findUnique({
      where: { id },
      include: { conditions: true },
    });

    if (!existingRule) {
      throw new NotFoundException(`Risk rule with ID ${id} not found`);
    }

    try {
      // Prepare update data
      const updateData: any = {
        roleName: updateRuleDto.roleName,
        ruleCode: updateRuleDto.ruleCode,
        riskLevel: updateRuleDto.riskLevel,
        eventName: updateRuleDto.eventName,
        score: updateRuleDto.score,
        conditionLogic: updateRuleDto.conditionLogic,
        affectedVariables: updateRuleDto.affectedVariables,
        taxonomy: updateRuleDto.taxonomy,
        regulatoryCitation: updateRuleDto.regulatoryCitation,
        redFlags: updateRuleDto.redFlags,
        isActive: updateRuleDto.isActive,
        // Legacy fields
        field: updateRuleDto.field,
        operator: updateRuleDto.operator,
        value: updateRuleDto.value,
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key],
      );

      // Handle conditions update
      if (updateRuleDto.conditions) {
        // Delete existing conditions
        await this.prisma.ruleCondition.deleteMany({
          where: { ruleId: id },
        });

        // Create new conditions
        updateData.conditions = {
          create: updateRuleDto.conditions.map((condition, index) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value || null,
            order: index,
          })),
        };
      }

      const rule = await this.prisma.riskRule.update({
        where: { id },
        data: updateData,
        include: {
          conditions: {
            orderBy: { order: 'asc' },
          },
        },
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

    // Get all active rules with their conditions
    const rules = await this.prisma.riskRule.findMany({
      where: { isActive: true },
      include: {
        conditions: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (rules.length === 0) {
      this.logger.warn('No active rules found for evaluation');
      // Remove any previous evaluations so summary reflects current state
      await this.prisma.riskEvaluation.deleteMany({
        where: { patientId },
      });
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

    // Remove all previous evaluations for this patient so that re-evaluation
    // reflects current rules and role conditions (no stale issues).
    await this.prisma.riskEvaluation.deleteMany({
      where: { patientId },
    });

    // Evaluate every active rule with current patient data and current rule definitions
    const evaluations: any[] = [];
    for (const rule of rules) {
      const evaluation = await this.evaluateRule(rule, patient);
      evaluations.push(evaluation);
    }

    // Aggregate total score and risk levels from new evaluations only
    let totalScore = 0;
    const riskLevels = new Set<string>();

    for (const evaluation of evaluations) {
      if (evaluation.matched) {
        totalScore += evaluation.score;
        if (evaluation.rule?.riskLevel) {
          riskLevels.add(evaluation.rule.riskLevel);
        }
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
      // Check if rule has conditions (new format) or legacy single condition
      const hasConditions = rule.conditions && rule.conditions.length > 0;
      const hasLegacyCondition = rule.field && rule.operator;

      if (hasConditions) {
        // Evaluate multiple conditions
        // If rule has eventName, evaluate conditions against each event record
        if (rule.eventName) {
          const eventData = this.getEventData(rule.eventName as EventName, patient);
          
          // Evaluate conditions against each record in the event data
          for (const record of eventData) {
            const recordMatched = this.evaluateConditionsAgainstRecord(
              rule.conditions,
              rule.conditionLogic || ConditionLogic.AND,
              record,
              patient,
            );
            
            if (recordMatched) {
              matched = true;
              // Get the matched value from the first condition field
              const firstCondition = rule.conditions[0];
              if (firstCondition) {
                const fieldValue = this.getFieldValue(record, firstCondition.field);
                matchedValue = fieldValue !== null && fieldValue !== undefined 
                  ? String(fieldValue) 
                  : 'Multiple conditions matched';
              } else {
                matchedValue = 'Multiple conditions matched';
              }
              eventId = record.id || record.epicId || null;
              break; // Match found, no need to check other records
            }
          }
        } else {
          // No eventName - evaluate against patient data directly
          matched = this.evaluateConditions(
            rule.conditions,
            rule.conditionLogic || ConditionLogic.AND,
            patient,
          );
          if (matched) {
            matchedValue = 'Multiple conditions matched';
          }
        }
      } else if (hasLegacyCondition) {
        // Legacy single condition evaluation
        const eventData = rule.eventName
          ? this.getEventData(rule.eventName as EventName, patient)
          : [patient];

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
      } else {
        this.logger.warn(
          `Rule ${rule.id} has no conditions defined, skipping evaluation`,
        );
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
        eventType: rule.eventName || 'MultiCondition',
        eventId,
      },
      include: {
        rule: true,
      },
    });

    return evaluation;
  }

  private evaluateConditions(
    conditions: any[],
    logic: ConditionLogic,
    patient: any,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return false;
    }

    // Get all patient data for condition evaluation
    const patientData = this.getAllPatientData(patient);

    // Evaluate each condition
    const conditionResults = conditions.map((condition) => {
      const fieldValue = this.getFieldValueFromPatientData(
        patientData,
        condition.field,
      );
      return this.compareValues(
        fieldValue,
        condition.operator,
        condition.value,
      );
    });

    // Apply logic (AND or OR)
    if (logic === ConditionLogic.AND) {
      return conditionResults.every((result) => result === true);
    } else {
      // OR logic
      return conditionResults.some((result) => result === true);
    }
  }

  /**
   * Evaluate conditions against a specific record (e.g., an observation, encounter, etc.)
   * This is used when evaluating event-based rules where conditions should be checked
   * against individual event records rather than patient data directly.
   */
  private evaluateConditionsAgainstRecord(
    conditions: any[],
    logic: ConditionLogic,
    record: any,
    patient: any,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return false;
    }

    // Get all patient data for condition evaluation (for fields that might reference patient data)
    const patientData = this.getAllPatientData(patient);
    
    // Merge record data with patient data (record takes precedence)
    const combinedData = {
      ...patientData,
      ...record,
    };

    // Evaluate each condition
    const conditionResults = conditions.map((condition) => {
      // First try to get field value from the record directly
      let fieldValue = this.getFieldValue(record, condition.field);
      
      // If not found in record, try from combined data (for nested access like "latestObservation.testName")
      if (fieldValue === null || fieldValue === undefined) {
        fieldValue = this.getFieldValueFromPatientData(
          combinedData,
          condition.field,
        );
      }
      
      return this.compareValues(
        fieldValue,
        condition.operator,
        condition.value,
      );
    });

    // Apply logic (AND or OR)
    if (logic === ConditionLogic.AND) {
      return conditionResults.every((result) => result === true);
    } else {
      // OR logic
      return conditionResults.some((result) => result === true);
    }
  }

  private getAllPatientData(patient: any): any {
    // Combine all patient data into a single object for field access
    // This allows conditions to access data from any source (patient, encounters, medications, etc.)
    return {
      // Patient fields
      ...patient,
      // Latest encounter data
      latestEncounter: patient.encounters?.[0] || null,
      // Latest medication
      latestMedication: patient.medications?.[0] || null,
      // Latest observation
      latestObservation: patient.observations?.[0] || null,
      // All encounters (for array access)
      encounters: patient.encounters || [],
      // All medications
      medications: patient.medications || [],
      // All observations
      observations: patient.observations || [],
      // All conditions
      conditions: patient.conditions || [],
      // All allergies
      allergies: patient.allergies || [],
      // All procedures
      procedures: patient.procedures || [],
      // All diagnostic reports
      diagnosticReports: patient.diagnosticReports || [],
    };
  }

  private getFieldValueFromPatientData(
    patientData: any,
    field: string,
  ): any {
    // Support nested field access and array indexing
    // Examples:
    // - "controlled_substance_prescribed" -> patientData.controlled_substance_prescribed
    // - "patient_identity_verified" -> patientData.patient_identity_verified
    // - "state_licensure_verified[patient_state]" -> patientData.state_licensure_verified[patient_state]
    // - "provider_location_state" -> patientData.provider_location_state
    // - "patient_location_state" -> patientData.patient_location_state

    // Handle array indexing syntax like "field[key]"
    const arrayIndexMatch = field.match(/^(.+)\[(.+)\]$/);
    if (arrayIndexMatch) {
      const arrayField = arrayIndexMatch[1];
      const indexKey = arrayIndexMatch[2];
      const arrayValue = this.getFieldValue(patientData, arrayField);
      if (Array.isArray(arrayValue)) {
        // If it's an array, try to find by key
        const index = parseInt(indexKey, 10);
        if (!isNaN(index)) {
          return arrayValue[index];
        }
      } else if (typeof arrayValue === 'object' && arrayValue !== null) {
        // If it's an object, access by key
        const keyValue = this.getFieldValue(patientData, indexKey);
        return arrayValue[keyValue];
      }
      return null;
    }

    // Standard nested field access
    return this.getFieldValue(patientData, field);
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
    operator: Operator | string,
    expectedValue: string | null | undefined,
  ): boolean {
    // Handle IS_NULL and IS_NOT_NULL operators
    if (operator === Operator.IS_NULL || operator === 'IS_NULL') {
      return actualValue === null || actualValue === undefined;
    }

    if (operator === Operator.IS_NOT_NULL || operator === 'IS_NOT_NULL') {
      return actualValue !== null && actualValue !== undefined;
    }

    // For other operators, actualValue must exist
    if (actualValue === null || actualValue === undefined) {
      return false;
    }

    // If expectedValue is not provided for other operators, return false
    if (expectedValue === null || expectedValue === undefined) {
      return false;
    }

    const actualStr = String(actualValue).toLowerCase();
    const expectedStr = String(expectedValue).toLowerCase();

    // Try to parse as numbers for numeric comparisons
    const actualNum = parseFloat(actualStr);
    const expectedNum = parseFloat(expectedStr);
    const isNumeric = !isNaN(actualNum) && !isNaN(expectedNum);

    switch (operator) {
      case Operator.EQUALS:
      case '=':
        return actualStr === expectedStr;
      case Operator.NOT_EQUALS:
      case '!=':
        return actualStr !== expectedStr;
      case Operator.LESS_THAN:
      case '<':
        return isNumeric ? actualNum < expectedNum : actualStr < expectedStr;
      case Operator.GREATER_THAN:
      case '>':
        return isNumeric ? actualNum > expectedNum : actualStr > expectedStr;
      case Operator.LESS_THAN_OR_EQUAL:
      case '<=':
        return isNumeric ? actualNum <= expectedNum : actualStr <= expectedStr;
      case Operator.GREATER_THAN_OR_EQUAL:
      case '>=':
        return isNumeric ? actualNum >= expectedNum : actualStr >= expectedStr;
      case Operator.CONTAINS:
      case 'contains':
        return actualStr.includes(expectedStr);
      case Operator.STARTS_WITH:
      case 'startsWith':
        return actualStr.startsWith(expectedStr);
      case Operator.ENDS_WITH:
      case 'endsWith':
        return actualStr.endsWith(expectedStr);
      default:
        this.logger.warn(`Unknown operator: ${operator}`);
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

    // Use only the latest evaluation per rule so we don't show stale issues
    const latestByRule = new Map<string, (typeof evaluations)[0]>();
    for (const e of evaluations) {
      if (!latestByRule.has(e.ruleId)) {
        latestByRule.set(e.ruleId, e);
      }
    }
    const latestEvaluations = Array.from(latestByRule.values());

    const matchedEvaluations = latestEvaluations.filter((e) => e.matched);
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

