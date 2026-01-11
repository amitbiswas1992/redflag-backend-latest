export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
  patientId?: string;
  expiresAt: number; // Unix timestamp
}
