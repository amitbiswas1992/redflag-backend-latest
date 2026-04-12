import { db, riskEvaluations, riskRules } from '@app/db';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CreateRiskRuleDto, EventName, UpdateRiskRuleDto } from './dto/risk-engine.dto';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    @Inject('REQUEST') private request: any,
  ) { }

  private get orgId(): string {
    const organizationId = this.request.organizationId ?? this.request.tenantId;
    if (!organizationId) throw new BadRequestException('Missing organizationId constraint');
    return organizationId;
  }

  async createRule(dto: CreateRiskRuleDto) {
    const ins = await db.insert(riskRules).values({
      organizationId: this.orgId,
      roleName: dto.roleName,
      ruleCode: dto.ruleCode,
      riskLevel: dto.riskLevel,
      score: dto.score,
      isActive: dto.isActive ?? true,
    } as any).returning();
    return ins[0];
  }

  async findAllRules(isActive?: boolean) {
    return db.select().from(riskRules).where(eq(riskRules.organizationId, this.orgId));
  }

  async findRuleById(id: string) {
    const res = await db
      .select()
      .from(riskRules)
      .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)));
    if (!res.length) throw new NotFoundException('Risk rule not found');
    return res[0];
  }

  async findRulesByEventName(eventName: EventName, isActive?: boolean) {
    return db.select().from(riskRules).where(eq(riskRules.organizationId, this.orgId));
  }

  async updateRule(id: string, updateRuleDto: UpdateRiskRuleDto) {
    const up = await db
      .update(riskRules)
      .set({ ...updateRuleDto } as any)
      .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
      .returning();
    if (!up.length) throw new NotFoundException('Risk rule not found');
    return up[0];
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
    return {
      patientId,
      totalScore: 0,
      matchedRulesCount: 0,
      highestRiskLevel: null,
      evaluations: [],
      lastEvaluatedAt: new Date(),
    };
  }

  async getPatientRiskSummary(patientId: string) {
    return { patientId, riskLevel: 'low', score: 0 };
  }

  async getPatientEvaluationHistory(patientId: string, limitNum: number) {
    return db
      .select()
      .from(riskEvaluations)
      .where(and(eq(riskEvaluations.patientId, patientId), eq(riskEvaluations.organizationId, this.orgId)))
      .limit(limitNum);
  }

  getRiskFieldNames() {
    return [];
  }
}
