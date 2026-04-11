import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SwaggerBasicAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Basic authentication required');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const swaggerUsername =
      this.configService.get<string>('SWAGGER_USERNAME') || 'admin';
    const swaggerPassword =
      this.configService.get<string>('SWAGGER_PASSWORD') || 'admin';

    if (username === swaggerUsername && password === swaggerPassword) {
      return true;
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}

