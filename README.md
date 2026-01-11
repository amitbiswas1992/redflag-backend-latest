# Redflag Epic Integration Service

A NestJS microservice that integrates with Epic EHR via SMART on FHIR (R4) using **Backend Systems** authentication (JWT Backend Service). Provides a clean internal API for other backend services to access clinical data.

## Features

- ✅ **JWT Backend Service Authentication** - Server-to-server authentication using JWT
- ✅ OAuth2 token management (in-memory storage)
- ✅ Automatic token refresh
- ✅ Epic FHIR API integration (R4)
- ✅ Epic FHIR Developer Sandbox support
- ✅ Clinical data normalization
- ✅ Internal REST APIs for other backend services
- ✅ Modular architecture
- ✅ Swagger/OpenAPI documentation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Other Services │───►│  Epic Service   │───►│   Epic EHR      │
│  (Internal API) │    │  (NestJS)       │    │  (FHIR R4)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                       ┌──────┴──────┐
                       │  JWT Auth   │
                       │  (Backend)  │
                       └─────────────┘
```

### Module Structure

- **ConfigModule**: Environment configuration
- **AuthModule**: JWT Backend Service authentication
- **TokenModule**: In-memory token storage and session management
- **FhirModule**: Epic FHIR API client
- **ClinicalModule**: Internal REST APIs with normalized data

## Prerequisites

- Node.js 18+
- Epic App Orchard account with **Backend Systems** application
- RSA key pair (public/private keys)
- Epic FHIR API access credentials

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Key Pair

Generate RSA key pair for JWT signing:

```bash
npm run generate-keys
```

This creates:

- `private_key.pem` - Keep secure! (used to sign JWTs)
- `public_key.pem` - Used automatically by the JWK Set endpoint

### 3. Configure JWK Set URL in Epic App Orchard

1. Start your application (the JWK Set endpoint is at `/.well-known/jwks.json`)
2. Log into Epic App Orchard: https://apporchard.epic.com/
3. Open your **Backend Systems** application
4. Find **"Non-Production JWK Set URL"** field
5. Enter your application's JWK Set URL: `https://your-app.com/.well-known/jwks.json`
6. For local development, use a tunnel service (e.g., ngrok)

**⚠️ Important**:

- The JWK Set URL must be publicly accessible over HTTPS (production) or via tunnel (local development)
- The Key ID (KID) is configured in your `.env` file (you choose this value)

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your Epic credentials:

#### For Sandbox (Testing)

```env
PORT=3000
EPIC_USE_SANDBOX=true
EPIC_CLIENT_ID=your-non-production-client-id-from-epic
EPIC_JWT_PRIVATE_KEY_PATH=private_key.pem
EPIC_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----
EPIC_JWT_KEY_ID=your-key-id-from-epic
EPIC_JWT_ISSUER=your-client-id-here
EPIC_JWT_SUBJECT=your-client-id-here
EPIC_SCOPE=system/Patient.read system/Observation.read system/Condition.read
```

#### For Production

```env
PORT=3000
EPIC_USE_SANDBOX=false
EPIC_CLIENT_ID=your-production-client-id-from-epic
EPIC_JWT_PRIVATE_KEY_PATH=private_key.pem
EPIC_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----
EPIC_JWT_KEY_ID=your-key-id-from-epic
EPIC_JWT_ISSUER=your-client-id-here
EPIC_JWT_SUBJECT=your-client-id-here
EPIC_FHIR_BASE_URL=https://your-org.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_TOKEN_URL=https://your-org.epic.com/interconnect-fhir-oauth/oauth2/token
EPIC_SCOPE=system/Patient.read system/Observation.read system/Condition.read
```

**📘 See `BACKEND_SYSTEMS_SETUP.md` for detailed setup guide.**

### 5. Start the Service

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The service will start on port 3000 (or the port specified in `.env`).

## Usage

### Step 1: Authenticate (Optional)

Authenticate your Backend System. Token is automatically managed and refreshed when needed:

```bash
GET http://localhost:3000/auth/token
```

**Example:**

```bash
curl "http://localhost:3000/auth/token"
```

**Response:**

```json
{
  "success": true,
  "expiresAt": "2024-01-05T12:00:00.000Z"
}
```

**Note:** Authentication is optional - tokens are automatically fetched and refreshed when making API calls.

### Step 2: Use Patient ID for API Calls

All clinical APIs require a `patientId` parameter. Token management is automatic:

#### Get Patient Information

```bash
curl "http://localhost:3000/api/clinical/patient?patientId=Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"
```

**Response:**

```json
{
  "id": "Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1980-01-01",
  "gender": "male",
  "identifiers": [
    {
      "system": "http://hospital.example.org/fhir/identifier/mrn",
      "value": "MRN123456"
    }
  ]
}
```

#### Get Observations

```bash
curl "http://localhost:3000/api/clinical/observations?patientId=Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"
```

**Response:**

```json
[
  {
    "id": "obs-123",
    "code": "8480-6",
    "display": "Systolic blood pressure",
    "category": "vital-signs",
    "value": 120,
    "unit": "mmHg",
    "date": "2024-01-05T10:30:00Z",
    "status": "final"
  }
]
```

#### Get Conditions (Diagnoses)

```bash
curl "http://localhost:3000/api/clinical/conditions?patientId=Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"
```

**Response:**

```json
[
  {
    "id": "cond-123",
    "code": "E11.9",
    "display": "Type 2 diabetes mellitus without complications",
    "category": "encounter-diagnosis",
    "status": "active",
    "onsetDate": "2020-01-15",
    "recordedDate": "2020-01-15T14:20:00Z"
  }
]
```

#### Get Complete Clinical Data

```bash
curl "http://localhost:3000/api/clinical/data?patientId=Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"
```

**Response:**

```json
{
  "patient": {
    "id": "Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB",
    "name": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "birthDate": "1980-01-01",
    "gender": "male"
  },
  "observations": [
    {
      "id": "obs-123",
      "code": "8480-6",
      "display": "Systolic blood pressure",
      "category": "vital-signs",
      "value": 120,
      "unit": "mmHg",
      "date": "2024-01-05T10:30:00Z",
      "status": "final"
    }
  ],
  "conditions": [
    {
      "id": "cond-123",
      "code": "E11.9",
      "display": "Type 2 diabetes mellitus without complications",
      "category": "encounter-diagnosis",
      "status": "active",
      "onsetDate": "2020-01-15",
      "recordedDate": "2020-01-15T14:20:00Z"
    }
  ]
}
```

### Token Refresh

Tokens are **automatically refreshed** when expired during API calls. You can also manually refresh:

```bash
curl "http://localhost:3000/auth/refresh"
```

## API Documentation

Swagger/OpenAPI documentation is available at:

```
http://localhost:3000/api/docs
```

The Swagger UI provides interactive API documentation where you can:

- View all available endpoints
- See request/response schemas
- Test endpoints directly from the browser
- View example requests and responses

## API Endpoints

### Authentication Endpoints

- `GET /auth/token` - Authenticate Backend System using JWT (optional - tokens auto-managed)
- `GET /auth/refresh` - Manually refresh access token (optional - tokens auto-refreshed)

### Clinical Data Endpoints (Internal API)

- `GET /api/clinical/patient?patientId={patientId}` - Get patient information
- `GET /api/clinical/observations?patientId={patientId}&category={optional}` - Get observations
- `GET /api/clinical/conditions?patientId={patientId}` - Get conditions/diagnoses
- `GET /api/clinical/data?patientId={patientId}` - Get complete clinical data

### Health Check

- `GET /health` - Health check endpoint

## Architecture Details

### Authentication Flow

1. **Generate JWT**: Service generates a JWT signed with your private key
2. **Request Token**: Sends JWT to Epic's token endpoint
3. **Epic Validates**: Epic validates JWT using the public key from your JWK Set URL
4. **Get Access Token**: Epic returns an access token
5. **Use Token**: Use access token for FHIR API calls

### Token Storage

- Single **global access token** stored in-memory
- Tokens are automatically fetched when needed
- Tokens are automatically refreshed when expired
- No sessions required - perfect for server-to-server communication

### Security

- **JWT Backend Service**: Uses RS256 algorithm with RSA key pair
- Tokens are stored in-memory (not persisted)
- Private keys should never be committed to version control
- All clinical APIs require a valid `patientId` parameter
- Token management is automatic and transparent

### Error Handling

- Authentication errors return 400 with descriptive messages
- FHIR API errors are logged and returned as 400 Bad Request
- Token refresh failures trigger re-authentication

## Development

### Project Structure

```
src/
├── config/              # Configuration module
│   ├── config.module.ts
│   └── epic.config.ts
├── auth/                # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── utils/
│       └── jwt.util.ts
├── token/               # Token management module
│   ├── token.module.ts
│   ├── token.service.ts
│   └── interfaces/
│       └── token.interface.ts
├── fhir/                # FHIR API client module
│   ├── fhir.module.ts
│   ├── fhir.service.ts
│   └── interfaces/
│       └── fhir.interface.ts
├── clinical/            # Clinical data API module
│   ├── clinical.module.ts
│   ├── clinical.controller.ts
│   ├── clinical.service.ts
│   └── interfaces/
│       └── clinical.interface.ts
├── app.module.ts
├── app.controller.ts
└── main.ts
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e
```

## Production Considerations

- **Token Storage**: Current implementation uses in-memory storage. For production, consider Redis or a database for persistence across service restarts.
- **Session Management**: Implement proper session cleanup and monitoring
- **Rate Limiting**: Add rate limiting for API endpoints
- **Logging**: Enhanced logging for audit trails
- **Monitoring**: Add metrics and health checks
- **HTTPS**: Always use HTTPS in production
- **Error Handling**: Implement proper error tracking and alerting
- **Key Management**: Use secure key management systems (AWS KMS, Azure Key Vault, etc.)

## Epic Configuration

To obtain Epic credentials:

1. Register your application in Epic App Orchard with **Application Audience = Backend Systems**
2. Generate RSA key pair (the public key is served via JWK Set endpoint)
3. Configure Non-Production JWK Set URL in Epic App Orchard
4. Configure Key ID (KID) in your `.env` file (you choose this value)
5. Request appropriate FHIR scopes
6. Get your organization-specific FHIR endpoints from Epic (if not using sandbox)

**Note**: Epic FHIR endpoints vary by organization. Contact your Epic support team for the correct URLs.

## Documentation

- **`BACKEND_SYSTEMS_SETUP.md`** - Complete guide for Backend Systems setup and configuration
- **`BACKEND_SYSTEMS_QUICK_START.md`** - Quick reference guide

## License

UNLICENSED
