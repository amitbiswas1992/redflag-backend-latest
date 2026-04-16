import {
  allergies,
  conditions,
  db,
  diagnosticReports,
  encounterAnalytics,
  encounters,
  medicationAnalytics,
  medications,
  observations,
  patients,
  procedures,
  riskEvaluations,
  riskRules,
  ruleConditions,
} from '@app/db';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  CreateRiskRuleDto,
  EventName,
  RuleConditionDto,
  UpdateRiskRuleDto,
} from './dto/risk-engine.dto';

type RequestContext = {
  organizationId?: string;
  tenantId?: string;
};

type RuleWithConditions = typeof riskRules.$inferSelect & {
  conditions: Array<typeof ruleConditions.$inferSelect>;
};

type PatientRuleContext = {
  values: Record<string, unknown>;
  eventIds: Partial<Record<EventName, string>>;
};

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    @Inject('REQUEST') private readonly request: RequestContext,
  ) { }

  private get orgId(): string {
    const organizationId = this.request.organizationId ?? this.request.tenantId;
    if (!organizationId) throw new BadRequestException('Missing organizationId constraint');
    return organizationId;
  }

  async createRule(dto: CreateRiskRuleDto) {
    const created = await db.transaction(async (tx) => {
      const [rule] = await tx
        .insert(riskRules)
        .values({
          organizationId: this.orgId,
          roleName: dto.roleName,
          ruleCode: dto.ruleCode,
          riskLevel: dto.riskLevel,
          eventName: dto.eventName,
          score: dto.score,
          conditionLogic: dto.conditionLogic ?? 'AND',
          affectedVariables: dto.affectedVariables,
          taxonomy: dto.taxonomy,
          regulatoryCitation: dto.regulatoryCitation,
          redFlags: dto.redFlags,
          isActive: dto.isActive ?? true,
          updatedAt: new Date(),
        })
        .returning();

      const conditionRows = this.buildConditionRows(rule.id, dto.conditions, dto);
      const insertedConditions =
        conditionRows.length > 0
          ? await tx.insert(ruleConditions).values(conditionRows).returning()
          : [];

      return {
        ...rule,
        conditions: insertedConditions,
      };
    });

    return created;
  }

  async findAllRules(isActive?: boolean) {
    const predicates = [eq(riskRules.organizationId, this.orgId)];
    if (typeof isActive === 'boolean') {
      predicates.push(eq(riskRules.isActive, isActive));
    }

    const rules = await db
      .select()
      .from(riskRules)
      .where(and(...predicates));

    return this.attachConditions(rules);
  }

  async findRuleById(id: string) {
    const [rule] = await db
      .select()
      .from(riskRules)
      .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)));
    if (!rule) throw new NotFoundException('Risk rule not found');

    const conditions = await db
      .select()
      .from(ruleConditions)
      .where(
        and(
          eq(ruleConditions.organizationId, this.orgId),
          eq(ruleConditions.ruleId, id),
        ),
      )
      .orderBy(asc(ruleConditions.order));

    return {
      ...rule,
      conditions,
    };
  }

  async findRulesByEventName(eventName: EventName, isActive?: boolean) {
    const predicates = [
      eq(riskRules.organizationId, this.orgId),
      eq(riskRules.eventName, eventName),
    ];
    if (typeof isActive === 'boolean') {
      predicates.push(eq(riskRules.isActive, isActive));
    }

    const rules = await db
      .select()
      .from(riskRules)
      .where(and(...predicates));

    return this.attachConditions(rules);
  }

  async updateRule(id: string, updateRuleDto: UpdateRiskRuleDto) {
    const updated = await db.transaction(async (tx) => {
      const [rule] = await tx
        .update(riskRules)
        .set({
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
          updatedAt: new Date(),
        })
        .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
        .returning();

      if (!rule) {
        return null;
      }

      const shouldRewriteConditions =
        updateRuleDto.conditions !== undefined ||
        this.hasLegacyCondition(updateRuleDto);

      if (shouldRewriteConditions) {
        await tx
          .delete(ruleConditions)
          .where(
            and(
              eq(ruleConditions.organizationId, this.orgId),
              eq(ruleConditions.ruleId, rule.id),
            ),
          );

        const conditionRows = this.buildConditionRows(
          rule.id,
          updateRuleDto.conditions,
          updateRuleDto,
        );

        if (conditionRows.length > 0) {
          await tx.insert(ruleConditions).values(conditionRows);
        }
      }

      const conditions = await tx
        .select()
        .from(ruleConditions)
        .where(
          and(
            eq(ruleConditions.organizationId, this.orgId),
            eq(ruleConditions.ruleId, rule.id),
          ),
        )
        .orderBy(asc(ruleConditions.order));

      return {
        ...rule,
        conditions,
      };
    });

    if (!updated) throw new NotFoundException('Risk rule not found');
    return updated;
  }

  async deleteRule(id: string) {
    const deleted = await db
      .delete(riskRules)
      .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
      .returning({ id: riskRules.id });
    if (!deleted.length) throw new NotFoundException('Risk rule not found');
    return { message: 'Risk rule deleted successfully' };
  }

  async evaluatePatientRules(patientId: string) {
    await this.assertPatientBelongsToOrganization(patientId);

    const rules = await this.findActiveRulesWithConditions();
    const context = await this.buildPatientRuleContext(patientId);
    const evaluatedAt = new Date();

    const evaluations: Array<Record<string, unknown>> = [];
    let totalScore = 0;
    let matchedRulesCount = 0;
    let highestRiskLevel: string | null = null;

    for (const rule of rules) {
      const conditionResults = rule.conditions.map((condition) => {
        const value = this.resolveRuleFieldValue(condition.field, context.values);
        const matched = this.evaluateCondition(value, condition.operator, condition.value);
        return {
          condition,
          value,
          matched,
        };
      });

      const matched = this.combineConditionResults(
        conditionResults.map((result) => result.matched),
        rule.conditionLogic,
      );

      const score = matched ? rule.score : 0;
      if (matched) {
        totalScore += score;
        matchedRulesCount += 1;
        highestRiskLevel = this.pickHigherRiskLevel(highestRiskLevel, rule.riskLevel);
      }

      const eventName = this.normalizeEventName(rule.eventName);
      const eventId = eventName ? context.eventIds[eventName] ?? null : patientId;
      const matchedValue = conditionResults
        .filter((result) => result.matched)
        .map((result) => {
          const renderedValue = this.renderRuleValue(result.value);
          return `${result.condition.field}=${renderedValue}`;
        })
        .join('; ');

      const [persistedEvaluation] = await db
        .insert(riskEvaluations)
        .values({
          organizationId: this.orgId,
          patientId,
          ruleId: rule.id,
          matched,
          matchedValue: matchedValue || null,
          score,
          evaluatedAt,
          eventType: eventName ?? 'Patient',
          eventId,
        })
        .onConflictDoUpdate({
          target: [
            riskEvaluations.organizationId,
            riskEvaluations.patientId,
            riskEvaluations.ruleId,
            riskEvaluations.eventId,
          ],
          set: {
            matched,
            matchedValue: matchedValue || null,
            score,
            evaluatedAt,
            eventType: eventName ?? 'Patient',
          },
        })
        .returning();

      evaluations.push({
        ...persistedEvaluation,
        rule: {
          id: rule.id,
          roleName: rule.roleName,
          ruleCode: rule.ruleCode,
          riskLevel: rule.riskLevel,
          eventName: rule.eventName,
          score: rule.score,
          conditionLogic: rule.conditionLogic,
          affectedVariables: rule.affectedVariables,
          taxonomy: rule.taxonomy,
          regulatoryCitation: rule.regulatoryCitation,
          redFlags: rule.redFlags,
          conditions: rule.conditions,
        },
      });
    }

    return {
      patientId,
      totalScore,
      matchedRulesCount,
      highestRiskLevel,
      evaluations,
      lastEvaluatedAt: evaluatedAt,
    };
  }

  async getPatientRiskSummary(patientId: string) {
    await this.assertPatientBelongsToOrganization(patientId);

    const history = await this.getPatientEvaluationHistory(patientId, 500);
    if (history.length === 0) {
      return {
        patientId,
        totalScore: 0,
        matchedRulesCount: 0,
        highestRiskLevel: null,
        evaluations: [],
        lastEvaluatedAt: new Date(0),
      };
    }

    const latestByRuleAndEvent = new Map<string, typeof riskEvaluations.$inferSelect>();
    for (const entry of history) {
      const eventId = entry.eventId ?? 'NO_EVENT';
      const key = `${entry.ruleId}::${eventId}`;
      if (!latestByRuleAndEvent.has(key)) {
        latestByRuleAndEvent.set(key, entry);
      }
    }

    const latestEvaluations = Array.from(latestByRuleAndEvent.values());
    const ruleIds = latestEvaluations.map((item) => item.ruleId);
    const rules =
      ruleIds.length > 0
        ? await db
          .select()
          .from(riskRules)
          .where(
            and(
              eq(riskRules.organizationId, this.orgId),
              inArray(riskRules.id, ruleIds),
            ),
          )
        : [];

    const rulesWithConditions = await this.attachConditions(rules);
    const rulesById = new Map(rulesWithConditions.map((rule) => [rule.id, rule]));

    const matchedEvaluations = latestEvaluations.filter((item) => item.matched);
    const totalScore = matchedEvaluations.reduce((sum, item) => sum + item.score, 0);

    let highestRiskLevel: string | null = null;
    for (const evaluation of matchedEvaluations) {
      const rule = rulesById.get(evaluation.ruleId);
      if (rule) {
        highestRiskLevel = this.pickHigherRiskLevel(highestRiskLevel, rule.riskLevel);
      }
    }

    return {
      patientId,
      totalScore,
      matchedRulesCount: matchedEvaluations.length,
      highestRiskLevel,
      evaluations: latestEvaluations.map((evaluation) => ({
        ...evaluation,
        rule: rulesById.get(evaluation.ruleId) ?? null,
      })),
      lastEvaluatedAt: latestEvaluations[0].evaluatedAt,
    };
  }

  async getPatientEvaluationHistory(patientId: string, limitNum: number) {
    return db
      .select()
      .from(riskEvaluations)
      .where(and(eq(riskEvaluations.patientId, patientId), eq(riskEvaluations.organizationId, this.orgId)))
      .orderBy(desc(riskEvaluations.evaluatedAt))
      .limit(limitNum);
  }

  getRiskFieldNames() {
    return [
      {
        table: 'Encounter',
        field: 'isTelehealth',
        fullName: 'Encounter.isTelehealth',
        description: 'Whether the encounter was telehealth',
      },
      {
        table: 'Encounter',
        field: 'crossStateFlag',
        fullName: 'Encounter.crossStateFlag',
        description: 'Whether encounter crossed state lines',
      },
      {
        table: 'Encounter',
        field: 'documentationComplete',
        fullName: 'Encounter.documentationComplete',
        description: 'Whether clinical documentation is complete',
      },
      {
        table: 'Encounter',
        field: 'patientIdentityVerified',
        fullName: 'Encounter.patientIdentityVerified',
        description: 'Whether patient identity was verified',
      },
      {
        table: 'Encounter',
        field: 'stateLicensureVerified',
        fullName: 'Encounter.stateLicensureVerified',
        description: 'Whether state licensure was verified',
      },
      {
        table: 'Medication',
        field: 'controlledSubstance',
        fullName: 'Medication.controlledSubstance',
        description: 'Whether medication is controlled substance',
      },
      {
        table: 'Medication',
        field: 'deaSchedule',
        fullName: 'Medication.deaSchedule',
        description: 'DEA schedule for medication',
      },
      {
        table: 'Medication',
        field: 'prescriberDea',
        fullName: 'Medication.prescriberDea',
        description: 'Prescriber DEA identifier',
      },
      {
        table: 'Medication',
        field: 'autoRefillEnabled',
        fullName: 'Medication.autoRefillEnabled',
        description: 'Whether auto refill is enabled',
      },
      {
        table: 'Medication',
        field: 'refillCount',
        fullName: 'Medication.refillCount',
        description: 'Number of authorized refills',
      },
      {
        table: 'Patient',
        field: 'gender',
        fullName: 'Patient.gender',
        description: 'Patient administrative gender',
      },
    ];
  }

  private async assertPatientBelongsToOrganization(patientId: string): Promise<void> {
    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.organizationId, this.orgId), eq(patients.id, patientId)))
      .limit(1);

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
  }

  private async findActiveRulesWithConditions(): Promise<RuleWithConditions[]> {
    const rules = await db
      .select()
      .from(riskRules)
      .where(and(eq(riskRules.organizationId, this.orgId), eq(riskRules.isActive, true)));

    return this.attachConditions(rules);
  }

  private async buildPatientRuleContext(patientId: string): Promise<PatientRuleContext> {
    const values: Record<string, unknown> = {};
    const eventIds: Partial<Record<EventName, string>> = {};

    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.organizationId, this.orgId), eq(patients.id, patientId)))
      .limit(1);

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    this.addRecordToContext(values, 'Patient', patient);

    const [encounter] = await db
      .select()
      .from(encounters)
      .where(
        and(
          eq(encounters.organizationId, this.orgId),
          eq(encounters.patientId, patientId),
        ),
      )
      .orderBy(desc(encounters.updatedAt))
      .limit(1);

    if (encounter) {
      eventIds[EventName.ENCOUNTER] = encounter.id;
      this.addRecordToContext(values, 'Encounter', encounter);

      const [encounterProjection] = await db
        .select()
        .from(encounterAnalytics)
        .where(
          and(
            eq(encounterAnalytics.organizationId, this.orgId),
            eq(encounterAnalytics.encounterId, encounter.id),
          ),
        )
        .limit(1);

      if (encounterProjection) {
        this.addRecordToContext(values, 'Encounter', encounterProjection);
      }
    }

    const [medication] = await db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.organizationId, this.orgId),
          eq(medications.patientId, patientId),
        ),
      )
      .orderBy(desc(medications.updatedAt))
      .limit(1);

    if (medication) {
      eventIds[EventName.MEDICATION] = medication.id;
      this.addRecordToContext(values, 'Medication', medication);

      const [medicationProjection] = await db
        .select()
        .from(medicationAnalytics)
        .where(
          and(
            eq(medicationAnalytics.organizationId, this.orgId),
            eq(medicationAnalytics.medicationId, medication.id),
          ),
        )
        .limit(1);

      if (medicationProjection) {
        this.addRecordToContext(values, 'Medication', medicationProjection);
      }
    }

    const [condition] = await db
      .select()
      .from(conditions)
      .where(
        and(
          eq(conditions.organizationId, this.orgId),
          eq(conditions.patientId, patientId),
        ),
      )
      .orderBy(desc(conditions.updatedAt))
      .limit(1);
    if (condition) {
      eventIds[EventName.CONDITION] = condition.id;
      this.addRecordToContext(values, 'Condition', condition);
    }

    const [observation] = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.organizationId, this.orgId),
          eq(observations.patientId, patientId),
        ),
      )
      .orderBy(desc(observations.updatedAt))
      .limit(1);
    if (observation) {
      eventIds[EventName.OBSERVATION] = observation.id;
      this.addRecordToContext(values, 'Observation', observation);
    }

    const [allergy] = await db
      .select()
      .from(allergies)
      .where(
        and(
          eq(allergies.organizationId, this.orgId),
          eq(allergies.patientId, patientId),
        ),
      )
      .orderBy(desc(allergies.updatedAt))
      .limit(1);
    if (allergy) {
      eventIds[EventName.ALLERGY] = allergy.id;
      this.addRecordToContext(values, 'Allergy', allergy);
    }

    const [procedure] = await db
      .select()
      .from(procedures)
      .where(
        and(
          eq(procedures.organizationId, this.orgId),
          eq(procedures.patientId, patientId),
        ),
      )
      .orderBy(desc(procedures.updatedAt))
      .limit(1);
    if (procedure) {
      eventIds[EventName.PROCEDURE] = procedure.id;
      this.addRecordToContext(values, 'Procedure', procedure);
    }

    const [diagnosticReport] = await db
      .select()
      .from(diagnosticReports)
      .where(
        and(
          eq(diagnosticReports.organizationId, this.orgId),
          eq(diagnosticReports.patientId, patientId),
        ),
      )
      .orderBy(desc(diagnosticReports.updatedAt))
      .limit(1);
    if (diagnosticReport) {
      eventIds[EventName.DIAGNOSTIC_REPORT] = diagnosticReport.id;
      this.addRecordToContext(values, 'DiagnosticReport', diagnosticReport);
    }

    return { values, eventIds };
  }

  private addRecordToContext(
    context: Record<string, unknown>,
    tableName: string,
    record: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(record)) {
      context[`${tableName}.${key}`] = value;
    }

    const extensionValue = record.extension;
    if (
      extensionValue &&
      typeof extensionValue === 'object' &&
      !Array.isArray(extensionValue)
    ) {
      for (const [key, value] of Object.entries(extensionValue as Record<string, unknown>)) {
        context[`${tableName}.${key}`] = value;
      }
    }
  }

  private resolveRuleFieldValue(
    field: string,
    context: Record<string, unknown>,
  ): unknown {
    if (field in context) {
      return context[field];
    }

    const normalizedTarget = this.normalizeFieldName(field);
    const matchingKey = Object.keys(context).find(
      (candidate) => this.normalizeFieldName(candidate) === normalizedTarget,
    );

    return matchingKey ? context[matchingKey] : null;
  }

  private evaluateCondition(
    rawValue: unknown,
    operator: string,
    expectedValue?: string | null,
  ): boolean {
    if (operator === 'IS_NULL') {
      return rawValue === null || rawValue === undefined;
    }

    if (operator === 'IS_NOT_NULL') {
      return rawValue !== null && rawValue !== undefined;
    }

    if (rawValue === null || rawValue === undefined) {
      return false;
    }

    const actualComparable = this.toComparableValue(rawValue);
    const expectedComparable = this.toComparableValue(expectedValue ?? null);

    switch (operator) {
      case '=':
        return actualComparable === expectedComparable;
      case '!=':
        return actualComparable !== expectedComparable;
      case '>':
        return this.compareComparable(actualComparable, expectedComparable) > 0;
      case '>=':
        return this.compareComparable(actualComparable, expectedComparable) >= 0;
      case '<':
        return this.compareComparable(actualComparable, expectedComparable) < 0;
      case '<=':
        return this.compareComparable(actualComparable, expectedComparable) <= 0;
      case 'contains':
        return this.renderRuleValue(rawValue)
          .toLowerCase()
          .includes(this.renderRuleValue(expectedValue ?? '').toLowerCase());
      case 'startsWith':
        return this.renderRuleValue(rawValue)
          .toLowerCase()
          .startsWith(this.renderRuleValue(expectedValue ?? '').toLowerCase());
      case 'endsWith':
        return this.renderRuleValue(rawValue)
          .toLowerCase()
          .endsWith(this.renderRuleValue(expectedValue ?? '').toLowerCase());
      default:
        this.logger.warn(`Unsupported rule operator: ${operator}`);
        return false;
    }
  }

  private combineConditionResults(matches: boolean[], logic?: string | null): boolean {
    if (matches.length === 0) {
      return false;
    }

    if (logic === 'OR') {
      return matches.some(Boolean);
    }

    return matches.every(Boolean);
  }

  private normalizeEventName(value?: string | null): EventName | null {
    if (!value) {
      return null;
    }

    const validValues = Object.values(EventName);
    return validValues.includes(value as EventName) ? (value as EventName) : null;
  }

  private normalizeFieldName(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  private toComparableValue(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      if (trimmed === 'true' || trimmed === 'false') {
        return trimmed === 'true';
      }

      const asNumber = Number(trimmed);
      if (!Number.isNaN(asNumber) && trimmed !== '') {
        return asNumber;
      }

      const asDate = new Date(trimmed);
      if (!Number.isNaN(asDate.getTime())) {
        return asDate.getTime();
      }

      return trimmed;
    }

    return this.renderRuleValue(value);
  }

  private compareComparable(
    left: string | number | boolean | null,
    right: string | number | boolean | null,
  ): number {
    if (left === null || right === null) {
      return Number(left) - Number(right);
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return Number(left) - Number(right);
    }

    return String(left).localeCompare(String(right));
  }

  private renderRuleValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return JSON.stringify(value);
  }

  private pickHigherRiskLevel(
    currentLevel: string | null,
    candidateLevel: string,
  ): string {
    const levelWeight: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    if (!currentLevel) {
      return candidateLevel;
    }

    const currentWeight = levelWeight[currentLevel.toLowerCase()] ?? 0;
    const candidateWeight = levelWeight[candidateLevel.toLowerCase()] ?? 0;
    return candidateWeight > currentWeight ? candidateLevel : currentLevel;
  }

  private buildConditionRows(
    ruleId: string,
    conditions: RuleConditionDto[] | undefined,
    legacyDto: {
      field?: string;
      operator?: string;
      value?: string;
    },
  ): Array<typeof ruleConditions.$inferInsert> {
    const sourceConditions =
      conditions && conditions.length > 0
        ? conditions
        : this.hasLegacyCondition(legacyDto)
          ? [
            {
              field: legacyDto.field!,
              operator: legacyDto.operator!,
              value: legacyDto.value,
            },
          ]
          : [];

    return sourceConditions.map((condition, index) => ({
      organizationId: this.orgId,
      ruleId,
      field: condition.field,
      operator: condition.operator,
      value: condition.value ?? null,
      order: index,
      updatedAt: new Date(),
    }));
  }

  private hasLegacyCondition(input: {
    field?: string;
    operator?: string;
  }): boolean {
    return Boolean(input.field && input.operator);
  }

  private async attachConditions(
    rules: Array<typeof riskRules.$inferSelect>,
  ): Promise<Array<typeof riskRules.$inferSelect & { conditions: Array<typeof ruleConditions.$inferSelect> }>> {
    if (rules.length === 0) {
      return [];
    }

    const ruleIds = rules.map((rule) => rule.id);
    const conditions = await db
      .select()
      .from(ruleConditions)
      .where(
        and(
          eq(ruleConditions.organizationId, this.orgId),
          inArray(ruleConditions.ruleId, ruleIds),
        ),
      )
      .orderBy(asc(ruleConditions.order));

    const conditionMap = new Map<string, Array<typeof ruleConditions.$inferSelect>>();
    for (const condition of conditions) {
      const existing = conditionMap.get(condition.ruleId) ?? [];
      existing.push(condition);
      conditionMap.set(condition.ruleId, existing);
    }

    return rules.map((rule) => ({
      ...rule,
      conditions: conditionMap.get(rule.id) ?? [],
    }));
  }
}
