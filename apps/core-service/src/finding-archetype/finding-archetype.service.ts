import { db, findingArchetypes, riskRules } from '@app/db';
import { syncRiskForArchetype } from '../rule-builder/rule-builder.service';
import type { RequestContext } from '@app/common';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, ilike, isNull } from 'drizzle-orm';
import {
    CreateFindingArchetypeDto,
    ListFindingArchetypesQuery,
    UpdateFindingArchetypeDto,
} from './dto/finding-archetype.dto';

const archetypeWithCatalogId = {
    id: findingArchetypes.id,
    organizationId: findingArchetypes.organizationId,
    ruleId: findingArchetypes.ruleId,
    description: findingArchetypes.description,
    severityRationale: findingArchetypes.severityRationale,
    applicableTheories: findingArchetypes.applicableTheories,
    parentId: findingArchetypes.parentId,
    scoreFactors: findingArchetypes.scoreFactors,
    createdAt: findingArchetypes.createdAt,
    updatedAt: findingArchetypes.updatedAt,
    catalogId: riskRules.ruleCode,
} as const;

@Injectable()
export class FindingArchetypeService {
    private readonly logger = new Logger(FindingArchetypeService.name);

    constructor(@Inject('REQUEST') private readonly request: RequestContext) {}

    private get orgId(): string {
        const id = this.request.session?.session.activeOrganizationId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    async list(query: ListFindingArchetypesQuery) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const predicates = [eq(findingArchetypes.organizationId, this.orgId)];
        if (query.ruleId) predicates.push(eq(findingArchetypes.ruleId, query.ruleId));
        if (query.parentId) predicates.push(eq(findingArchetypes.parentId, query.parentId));
        if (query.catalogId) predicates.push(ilike(riskRules.ruleCode, `%${query.catalogId}%`));

        const [{ total }] = await db
            .select({ total: count() })
            .from(findingArchetypes)
            .leftJoin(riskRules, eq(findingArchetypes.ruleId, riskRules.id))
            .where(and(...predicates));

        const data = await db
            .select(archetypeWithCatalogId)
            .from(findingArchetypes)
            .leftJoin(riskRules, eq(findingArchetypes.ruleId, riskRules.id))
            .where(and(...predicates))
            .orderBy(asc(riskRules.serial), asc(findingArchetypes.createdAt))
            .limit(limit)
            .offset(offset);

        return { data, total: Number(total ?? 0), page, limit };
    }

    async getById(id: string) {
        const [archetype] = await db
            .select(archetypeWithCatalogId)
            .from(findingArchetypes)
            .leftJoin(riskRules, eq(findingArchetypes.ruleId, riskRules.id))
            .where(and(eq(findingArchetypes.id, id), eq(findingArchetypes.organizationId, this.orgId)));
        if (!archetype) throw new NotFoundException('Finding archetype not found');
        return archetype;
    }

    async create(dto: CreateFindingArchetypeDto) {
        if (dto.parentId) {
            const [parent] = await db
                .select({ id: findingArchetypes.id })
                .from(findingArchetypes)
                .where(and(eq(findingArchetypes.id, dto.parentId), eq(findingArchetypes.organizationId, this.orgId)))
                .limit(1);
            if (!parent) throw new NotFoundException('Parent archetype not found');
        }

        const [created] = await db
            .insert(findingArchetypes)
            .values({
                organizationId: this.orgId,
                ruleId: dto.ruleId ?? null,
                description: dto.description ?? null,
                severityRationale: dto.severityRationale ?? null,
                applicableTheories: dto.applicableTheories ?? null,
                parentId: dto.parentId ?? null,
                scoreFactors: dto.scoreFactors ?? null,
            })
            .returning();
        return created;
    }

    async update(id: string, dto: UpdateFindingArchetypeDto) {
        const [existing] = await db
            .select({
                id: findingArchetypes.id,
                parentId: findingArchetypes.parentId,
                ruleId: findingArchetypes.ruleId,
            })
            .from(findingArchetypes)
            .where(and(eq(findingArchetypes.id, id), eq(findingArchetypes.organizationId, this.orgId)))
            .limit(1);
        if (!existing) throw new NotFoundException('Finding archetype not found');

        if (dto.parentId) {
            if (dto.parentId === id) throw new BadRequestException('An archetype cannot be its own parent');
            const [parent] = await db
                .select({ id: findingArchetypes.id })
                .from(findingArchetypes)
                .where(and(eq(findingArchetypes.id, dto.parentId), eq(findingArchetypes.organizationId, this.orgId)))
                .limit(1);
            if (!parent) throw new NotFoundException('Parent archetype not found');
        }

        const [updated] = await db
            .update(findingArchetypes)
            .set({
                ruleId: dto.ruleId,
                description: dto.description,
                severityRationale: dto.severityRationale,
                applicableTheories: dto.applicableTheories,
                parentId: dto.parentId,
                scoreFactors: dto.scoreFactors,
                updatedAt: new Date(),
            })
            .where(and(eq(findingArchetypes.id, id), eq(findingArchetypes.organizationId, this.orgId)))
            .returning();
        await syncRiskForArchetype(id);
        return updated;
    }

    async delete(id: string) {
        const children = await db
            .select({ id: findingArchetypes.id })
            .from(findingArchetypes)
            .where(and(eq(findingArchetypes.parentId, id), eq(findingArchetypes.organizationId, this.orgId)))
            .limit(1);
        if (children.length) {
            throw new BadRequestException('Cannot delete archetype with child archetypes. Remove or re-parent children first.');
        }

        const [deleted] = await db
            .delete(findingArchetypes)
            .where(and(eq(findingArchetypes.id, id), eq(findingArchetypes.organizationId, this.orgId)))
            .returning({ id: findingArchetypes.id });
        if (!deleted) throw new NotFoundException('Finding archetype not found');
        return { message: 'Archetype deleted' };
    }

    async getRoots() {
        return db
            .select(archetypeWithCatalogId)
            .from(findingArchetypes)
            .leftJoin(riskRules, eq(findingArchetypes.ruleId, riskRules.id))
            .where(and(eq(findingArchetypes.organizationId, this.orgId), isNull(findingArchetypes.parentId)))
            .orderBy(asc(riskRules.serial), asc(findingArchetypes.createdAt));
    }

    async getChildren(parentId: string) {
        return db
            .select(archetypeWithCatalogId)
            .from(findingArchetypes)
            .leftJoin(riskRules, eq(findingArchetypes.ruleId, riskRules.id))
            .where(and(eq(findingArchetypes.organizationId, this.orgId), eq(findingArchetypes.parentId, parentId)))
            .orderBy(asc(findingArchetypes.createdAt));
    }
}
