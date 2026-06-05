import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { auth } from '../auth';

export type RequestContext = {
    session?: UserSession<typeof auth>;
};
