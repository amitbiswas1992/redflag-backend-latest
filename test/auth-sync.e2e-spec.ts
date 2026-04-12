import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

jest.mock('@app/db', () => ({
    db: {},
    organizationMemberships: {},
    organizations: {},
    users: {},
}));

jest.mock('@app/common', () => ({
    KeycloakAuthGuard: class KeycloakAuthGuard {
        canActivate() {
            return true;
        }
    },
    InternalAuthGuard: class InternalAuthGuard {
        canActivate() {
            return true;
        }
    },
}));

import { InternalAuthGuard, KeycloakAuthGuard } from '@app/common';
import { AuthController } from '../apps/identity-service/src/auth.controller';
import { AuthService } from '../apps/identity-service/src/auth.service';
import { IdentityService } from '../apps/identity-service/src/identity.service';

class MockKeycloakAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        req.keycloakUser = {
            sub: 'kc-user-1',
            email: 'user@example.com',
            firstName: 'Sam',
            lastName: 'Doe',
        };
        return true;
    }
}

class MockInternalAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        req.user = {
            id: 'user-1',
        };
        return true;
    }
}

describe('Auth Sync (e2e contract)', () => {
    let app: INestApplication;

    const authService = {
        syncWithKeycloak: jest.fn(),
        getMe: jest.fn(),
        switchTenant: jest.fn(),
        registerWithKeycloak: jest.fn(),
        loginWithKeycloak: jest.fn(),
        decodeToken: jest.fn(),
        bootstrapOrganizationForUser: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: authService,
                },
                {
                    provide: IdentityService,
                    useValue: {},
                },
            ],
        })
            .overrideGuard(KeycloakAuthGuard)
            .useClass(MockKeycloakAuthGuard)
            .overrideGuard(InternalAuthGuard)
            .useClass(MockInternalAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns no-org sync shape when user has no organizations', async () => {
        authService.syncWithKeycloak.mockResolvedValueOnce({
            access_token: 'token-no-org',
            user: {
                id: 'user-1',
                email: 'user@example.com',
            },
            tenants: [],
            needsOrganizationSetup: true,
        });

        const response = await request(app.getHttpServer())
            .post('/auth/sync')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            access_token: 'token-no-org',
            tenants: [],
            needsOrganizationSetup: true,
        });
    });

    it('returns tenant sync shape when user already has organization membership', async () => {
        authService.syncWithKeycloak.mockResolvedValueOnce({
            access_token: 'token-has-org',
            user: {
                id: 'user-1',
                email: 'user@example.com',
            },
            tenants: [
                {
                    id: 'org-1',
                    name: 'Acme Health',
                    slug: 'acme-health',
                    role: 'OWNER',
                },
            ],
            needsOrganizationSetup: false,
        });

        const response = await request(app.getHttpServer())
            .post('/auth/sync')
            .send({ organization_name: 'Acme Health' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            access_token: 'token-has-org',
            needsOrganizationSetup: false,
        });
        expect(response.body.tenants).toHaveLength(1);

        expect(authService.syncWithKeycloak).toHaveBeenCalledWith(
            expect.objectContaining({
                sub: 'kc-user-1',
                email: 'user@example.com',
            }),
            expect.objectContaining({
                defaultOrganizationName: 'Acme Health',
            })
        );
    });
});
