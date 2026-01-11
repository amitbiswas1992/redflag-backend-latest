import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'Whether the token refresh was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Token expiration time in ISO format',
    example: '2024-01-05T12:00:00.000Z',
  })
  expiresAt: string;
}

export class RefreshTokenErrorDto {
  @ApiProperty({
    description: 'Whether the token refresh was successful',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'Error message',
    example: 'Failed to refresh tokens. Please re-authenticate.',
  })
  error: string;
}
