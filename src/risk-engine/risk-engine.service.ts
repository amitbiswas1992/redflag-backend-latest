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

  /**
   * Helper to parse a fully-qualified field name like
   * "Encounter.patientIdentityVerified" into a source model and a
   * path that can be resolved on that model instance.
   */
  private parseQualifiedField(field: string): {
    source: string;
    path: string;
  } {
    if (!field) {
      return { source: 'Patient', path: '' };
    }

    const parts = field.split('.');
    if (parts.length === 1) {
      // No explicit source → treat as Patient-level field
      return { source: 'Patient', path: parts[0] };
    }

    const [source, ...rest] = parts;
    return { source, path: rest.join('.') };
  }

  /**
   * Get the "current" record for a given source model from the patient object.
   * For event-like resources (Encounter, Medication, etc.) this returns the
   * latest record (index 0) if present.
   */
  private getSourceRecord(patient: any, source: string): any | null {
    switch (source) {
      case 'Patient':
        return patient;
      case 'Encounter':
        return patient.encounters?.[0] || null;
      case 'Medication':
        return patient.medications?.[0] || null;
      case 'Observation':
        return patient.observations?.[0] || null;
      case 'Condition':
        return patient.conditions?.[0] || null;
      case 'Allergy':
        return patient.allergies?.[0] || null;
      case 'Procedure':
        return patient.procedures?.[0] || null;
      case 'DiagnosticReport':
        return patient.diagnosticReports?.[0] || null;
      default:
        // Unknown prefix – treat as patient-level field
        return patient;
    }
  }

  /**
   * Static catalog of fields that can be used in risk rule conditions,
   * with their logical table/model prefix.
   *
   * NOTE: These names correspond to Prisma model fields as exposed via
   * getAllPatientData / getEventData in this service.
   */
  private readonly riskFieldCatalog = [
    // Encounter-based fields
    {
      table: 'Encounter',
      field: 'practitionerName',
      description: 'Display name of the practitioner for this encounter',
    },
    {
      table: 'Encounter',
      field: 'isTelehealth',
      description: 'Whether the encounter was conducted via telehealth',
    },
    {
      table: 'Encounter',
      field: 'telehealthId',
      description: 'External telehealth platform session identifier',
    },
    {
      table: 'Encounter',
      field: 'patientIdentityVerified',
      description: 'Whether patient identity verification was documented',
    },
    {
      table: 'Encounter',
      field: 'consentObtained',
      description: 'Whether required consent was obtained',
    },
    {
      table: 'Encounter',
      field: 'informedConsentType',
      description: 'Type of informed consent (e.g., telehealth-specific)',
    },
    {
      table: 'Encounter',
      field: 'sessionRecordingConsent',
      description: 'Whether consent for recording the session was obtained',
    },
    {
      table: 'Encounter',
      field: 'providerLocation',
      description: 'Text description of provider location during encounter',
    },
    {
      table: 'Encounter',
      field: 'providerLocationState',
      description: 'US state (or region) of provider during encounter',
    },
    {
      table: 'Encounter',
      field: 'patientLocation',
      description: 'Text description of patient location during encounter',
    },
    {
      table: 'Encounter',
      field: 'patientLocationState',
      description: 'US state (or region) of patient during encounter',
    },
    {
      table: 'Encounter',
      field: 'stateLicensureVerified',
      description: 'JSON map of state → licensure verification status',
    },
    {
      table: 'Encounter',
      field: 'crossStateLicense',
      description: 'Whether cross-state license is documented',
    },
    {
      table: 'Encounter',
      field: 'encounterType',
      description: "Encounter type label (e.g. 'New', 'Follow-up')",
    },
    {
      table: 'Encounter',
      field: 'sessionDurationMinutes',
      description: 'Encounter/session duration in minutes',
    },
    {
      table: 'Encounter',
      field: 'sessionStartTime',
      description: 'Encounter/session start timestamp',
    },
    {
      table: 'Encounter',
      field: 'sessionEndTime',
      description: 'Encounter/session end timestamp',
    },
    {
      table: 'Encounter',
      field: 'mentalHealthScreening',
      description: 'Mental health screening instrument/status',
    },
    {
      table: 'Encounter',
      field: 'substanceUseScreening',
      description: 'Substance use screening instrument/status',
    },
    {
      table: 'Encounter',
      field: 'chiefComplaint',
      description: 'Chief complaint / reason for visit (free text)',
    },
    {
      table: 'Encounter',
      field: 'followUpScheduled',
      description: 'Whether a follow-up was scheduled',
    },
    {
      table: 'Encounter',
      field: 'carePlanUpdated',
      description: 'Whether care plan was updated this encounter',
    },
    {
      table: 'Encounter',
      field: 'vitalSignsRecorded',
      description: 'Whether vital signs were recorded',
    },
    {
      table: 'Encounter',
      field: 'outcomeMeasured',
      description: 'Outcome measurement or summary text',
    },
    {
      table: 'Encounter',
      field: 'coordinationWithPcp',
      description: 'Whether coordination with primary care provider occurred',
    },
    {
      table: 'Encounter',
      field: 'clinicalNotesCompleted',
      description: 'Clinical note completion status',
    },
    {
      table: 'Encounter',
      field: 'noteSignedDate',
      description: 'When clinical note was signed',
    },
    {
      table: 'Encounter',
      field: 'allergiesReviewed',
      description: 'Whether allergies were reviewed',
    },
    {
      table: 'Encounter',
      field: 'technologyAssessment',
      description: 'Assessment of patient’s ability to use technology',
    },
    {
      table: 'Encounter',
      field: 'clinicalDecisionMaker',
      description: 'Who is documented as clinical decision maker',
    },
    {
      table: 'Encounter',
      field: 'qualityMeasureMet',
      description: 'Whether required quality measure was met',
    },

    // Medication-based fields
    {
      table: 'Medication',
      field: 'medication',
      description: 'Medication name/prescription',
    },
    {
      table: 'Medication',
      field: 'controlledSubstancePrescribed',
      description: 'Whether the medication is a controlled substance',
    },
    {
      table: 'Medication',
      field: 'refillCount',
      description: 'Number of refills on this prescription',
    },
    {
      table: 'Medication',
      field: 'autoRefillEnabled',
      description: 'Whether auto-refill is enabled for this medication',
    },
    {
      table: 'Medication',
      field: 'medicationAdherence',
      description: 'Documented medication adherence status',
    },
    {
      table: 'Medication',
      field: 'clinicalDecisionSupport',
      description: 'Number of CDS alerts triggered for this medication',
    },
    {
      table: 'Medication',
      field: 'overrideReason',
      description: 'Override reason when CDS alerts are bypassed',
    },
    {
      table: 'Medication',
      field: 'quantity',
      description: 'Dispensed quantity (e.g., tablets)',
    },
    {
      table: 'Medication',
      field: 'substanceCode',
      description: 'Substance code (e.g., RxNorm code)',
    },
    {
      table: 'Medication',
      field: 'substanceExpiry',
      description: 'Medication expiry date',
    },
    {
      table: 'Medication',
      field: 'prescriptionWritten',
      description: 'Whether a prescription was written in this context',
    },

    // Condition-based fields
    {
      table: 'Condition',
      field: 'diagnosis',
      description: 'Primary diagnosis or condition name',
    },
    {
      table: 'Condition',
      field: 'status',
      description: 'Condition status (e.g., active, resolved)',
    },
    {
      table: 'Condition',
      field: 'onsetDate',
      description: 'Date when condition started',
    },
  ].map((f) => ({
    ...f,
    fullName: `${f.table}.${f.field}`,
  }));

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

    // Get patient data, always ordering related clinical records so that
    // index 0 in each array is the latest record for that type.
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        observations: {
          orderBy: { createdAt: 'desc' },
        },
        conditions: {
          orderBy: { createdAt: 'desc' },
        },
        allergies: {
          orderBy: { createdAt: 'desc' },
        },
        medications: {
          orderBy: { createdAt: 'desc' },
        },
        procedures: {
          orderBy: { createdAt: 'desc' },
        },
        encounters: {
          orderBy: { createdAt: 'desc' },
        },
        diagnosticReports: {
          orderBy: { createdAt: 'desc' },
        },
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

  /**
   * Return all available risk rule field names with their table prefix.
   * These are the canonical names that can be used in RuleConditionDto.field
   * in the form "Model.fieldName", e.g. "Encounter.patientIdentityVerified".
   */
  getRiskFieldNames() {
    return this.riskFieldCatalog;
  }

  private async evaluateRule(rule: any, patient: any) {
    let matched = false;
    let matchedValue: string | null = null;
    let eventId: string | null = null;

    try {
      const conditions = rule.conditions || [];
      if (!conditions.length) {
        this.logger.warn(
          `Rule ${rule.id} has no conditions defined, skipping evaluation`,
        );
      } else {
        // Multi-condition evaluation against fully-qualified field names.
        const logic: ConditionLogic =
          rule.conditionLogic || ConditionLogic.AND;

        const results: boolean[] = [];
        let firstFieldValue: any = null;
        let firstSourceRecord: any = null;

        for (const condition of conditions) {
          const { source, path } = this.parseQualifiedField(condition.field);
          const record = this.getSourceRecord(patient, source);

          let fieldValue: any = null;
          if (record && path) {
            fieldValue = this.getFieldValue(record, path);
          }

          const conditionResult = this.compareValues(
            fieldValue,
            condition.operator,
            condition.value,
          );
          results.push(conditionResult);

          if (firstFieldValue === null && fieldValue !== undefined) {
            firstFieldValue = fieldValue;
            firstSourceRecord = record;
          }
        }

        if (logic === ConditionLogic.AND) {
          matched = results.every((r) => r === true);
        } else {
          matched = results.some((r) => r === true);
        }

        if (matched) {
          matchedValue =
            firstFieldValue !== null && firstFieldValue !== undefined
              ? String(firstFieldValue)
              : 'Multiple conditions matched';
          eventId =
            firstSourceRecord?.id ||
            firstSourceRecord?.epicId ||
            patient.id ||
            null;
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
        eventType: rule.eventName || 'MultiCondition',
        eventId,
      },
      include: {
        rule: true,
      },
    });

    return evaluation;
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

    // Normalize boolean-like values
    const normalizeBool = (v: any): boolean | null => {
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      if (s === '1' || s === 'true') return true;
      if (s === '0' || s === 'false') return false;
      return null;
    };

    const actualBool = normalizeBool(actualValue);
    const expectedBool = normalizeBool(expectedValue);

    const actualStr = String(actualValue).toLowerCase();
    const expectedStr = String(expectedValue).toLowerCase();

    // Try to parse as numbers for numeric comparisons
    const actualNum = parseFloat(actualStr);
    const expectedNum = parseFloat(expectedStr);
    const isNumeric = !isNaN(actualNum) && !isNaN(expectedNum);

    switch (operator) {
      case Operator.EQUALS:
      case '=':
        // If both sides look boolean-like, compare as booleans
        if (actualBool !== null && expectedBool !== null) {
          return actualBool === expectedBool;
        }
        return actualStr === expectedStr;
      case Operator.NOT_EQUALS:
      case '!=':
        if (actualBool !== null && expectedBool !== null) {
          return actualBool !== expectedBool;
        }
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

