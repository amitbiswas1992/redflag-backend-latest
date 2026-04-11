import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { db, riskRules, riskEvaluations, patients } from '@app/db';
import { eq, desc } from 'drizzle-orm';
import { CreateRiskRuleDto, UpdateRiskRuleDto, EventName, ConditionLogic } from './dto/risk-engine.dto';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    @Inject('REQUEST') private request: any,
  ) { }

  private get orgId(): string {
    const organizationId = this.request.organizationId;
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
    const res = await db.select().from(riskRules).where(eq(riskRules.id, id));
    return res[0];
  }

  async findRulesByEventName(eventName: EventName, isActive?: boolean) {
    return db.select().from(riskRules).where(eq(riskRules.organizationId, this.orgId));
  }

  async updateRule(id: string, updateRuleDto: UpdateRiskRuleDto) {
    const up = await db.update(riskRules).set({ ...updateRuleDto } as any).where(eq(riskRules.id, id)).returning();
    return up[0];
  }

  async deleteRule(id: string) {
    await db.delete(riskRules).where(eq(riskRules.id, id));
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
    return db.select().from(riskEvaluations).where(eq(riskEvaluations.patientId, patientId)).limit(limitNum);
  }

  getRiskFieldNames() {
    return [];
  }
}
