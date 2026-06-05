import { db, findingArchetypes, riskRules, ruleCategories } from '@app/db';
import { syncRiskForArchetype } from '../rule-builder/rule-builder.service';
import type { RequestContext } from '@app/common';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, ilike, isNull, sql } from 'drizzle-orm';
import {
    CreateFindingArchetypeDto,
    ListFindingArchetypesQuery,
    UpdateFindingArchetypeDto,
} from './dto/finding-archetype.dto';

@Injectable()
export class FindingArchetypeService {
    private readonly logger = new Logger(FindingArchetypeService.name);

    constructor(@Inject('REQUEST') private readonly request: RequestContext) {}

    private get orgId(): string {
        const id = this.request.session?.session.activeOrganizationId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    // ── Auto-generation helpers ───────────────────────────────────────────────

    private async nextSerial(parentId?: string | null, ruleId?: string | null): Promise<number> {
        const predicates = [eq(findingArchetypes.organizationId, this.orgId)];
        if (parentId) {
            predicates.push(eq(findingArchetypes.parentId, parentId));
        } else if (ruleId) {
            predicates.push(eq(findingArchetypes.ruleId, ruleId));
        } else {
            return 1;
        }
        const [{ maxSerial }] = await db
            .select({ maxSerial: sql<number>`COALESCE(MAX(${findingArchetypes.serial}), 0)` })
            .from(findingArchetypes)
            .where(and(...predicates));
        return (maxSerial ?? 0) + 1;
    }

    private async buildCatalogId(
        serial: number,
        parentId?: string | null,
        ruleId?: string | null,
    ): Promise<string | null> {
        if (parentId) {
            const [parent] = await db
                .select({ catalogId: findingArchetypes.catalogId })
                .from(findingArchetypes)
                .where(eq(findingArchetypes.id, parentId))
                .limit(1);
            return parent?.catalogId ? `${parent.catalogId}.${serial}` : null;
        }
        if (ruleId) {
            const [rule] = await db
                .select({ categoryId: riskRules.categoryId })
                .from(riskRules)
                .where(eq(riskRules.id, ruleId))
                .limit(1);
            if (rule?.categoryId) {
                const [cat] = await db
                    .select({ prefix: ruleCategories.prefix })
                    .from(ruleCategories)
                    .where(eq(ruleCategories.id, rule.categoryId))
                    .limit(1);
                if (cat?.prefix) {
                    return `${cat.prefix}-${String(serial).padStart(3, '0')}`;
                }
            }
        }
        return null;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    async list(query: ListFindingArchetypesQuery) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const predicates = [eq(findingArchetypes.organizationId, this.orgId)];
        if (query.ruleId) predicates.push(eq(findingArchetypes.ruleId, query.ruleId));
        if (query.parentId) predicates.push(eq(findingArchetypes.parentId, query.parentId));
        if (query.catalogId) predicates.push(ilike(findingArchetypes.catalogId, `%${query.catalogId}%`));

        const [{ total }] = await db
            .select({ total: count() })
            .from(findingArchetypes)
            .where(and(...predicates));

        const data = await db
            .select()
            .from(findingArchetypes)
            .where(and(...predicates))
            .orderBy(asc(findingArchetypes.serial), asc(findingArchetypes.createdAt))
            .limit(limit)
            .offset(offset);

        return { data, total: Number(total ?? 0), page, limit };
    }

    async getById(id: string) {
        const [archetype] = await db
            .select()
            .from(findingArchetypes)
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

        const serial = dto.serial ?? await this.nextSerial(dto.parentId, dto.ruleId);
        const catalogId = dto.catalogId ?? await this.buildCatalogId(serial, dto.parentId, dto.ruleId);

        const [created] = await db
            .insert(findingArchetypes)
            .values({
                organizationId: this.orgId,
                ruleId: dto.ruleId ?? null,
                description: dto.description ?? null,
                severityRationale: dto.severityRationale ?? null,
                applicableTheories: dto.applicableTheories ?? null,
                parentId: dto.parentId ?? null,
                serial,
                catalogId,
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
                serial: findingArchetypes.serial,
                catalogId: findingArchetypes.catalogId,
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

        // Determine effective grouping key after the update
        const newParentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;
        const newRuleId = dto.ruleId !== undefined ? dto.ruleId : existing.ruleId;
        const groupingChanged =
            newParentId !== existing.parentId || newRuleId !== existing.ruleId;

        let serial = dto.serial !== undefined ? dto.serial : existing.serial;
        let catalogId = dto.catalogId !== undefined ? dto.catalogId : existing.catalogId;

        if (groupingChanged && dto.serial === undefined) {
            serial = await this.nextSerial(newParentId, newRuleId);
        }
        if (groupingChanged && dto.catalogId === undefined) {
            catalogId = await this.buildCatalogId(serial!, newParentId, newRuleId);
        }

        const [updated] = await db
            .update(findingArchetypes)
            .set({
                ruleId: dto.ruleId,
                description: dto.description,
                severityRationale: dto.severityRationale,
                applicableTheories: dto.applicableTheories,
                parentId: dto.parentId,
                serial,
                catalogId,
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
            .select()
            .from(findingArchetypes)
            .where(and(eq(findingArchetypes.organizationId, this.orgId), isNull(findingArchetypes.parentId)))
            .orderBy(asc(findingArchetypes.serial), asc(findingArchetypes.createdAt));
    }

    async getChildren(parentId: string) {
        return db
            .select()
            .from(findingArchetypes)
            .where(and(eq(findingArchetypes.organizationId, this.orgId), eq(findingArchetypes.parentId, parentId)))
            .orderBy(asc(findingArchetypes.serial), asc(findingArchetypes.createdAt));
    }
}
