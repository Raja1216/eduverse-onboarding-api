# NestJS + Prisma OTP Registration Backend

This service connects to the existing LMS MySQL database and reuses the existing Prisma models/tables.

## Registration flow

1. Send OTP.
2. Resend OTP if needed (30-second cooldown by default).
3. Verify OTP.
4. Verification returns a signed, short-lived `registrationToken` and whether the mobile is already registered.
5. Fetch schools from the `institutions` table for the frontend dropdown.
6. Register using the token and selected school.
7. Registration stores only the institution's **name** in `users.schoolName`. It does **not** create an `InstitutionMember` row.
8. Student role is attached and class-based courses are inserted into `user_enrolled_courses`.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npm run start:dev
```

Do not run `prisma db push` against the existing LMS database just to use this service.

## Course mapping

Edit:

```text
src/config/class-course-map.ts
```

Example:

```ts
export const CLASS_COURSE_MAP: Record<string, number[]> = {
  '6': [10, 11, 12],
  '7': [20, 21],
  '8': [30, 31],
};
```

The API accepts values such as `6`, `Class 6`, and `VI`, and normalizes them to `6` before looking up the configured courses.

---

# APIs

## 1. Send OTP

```http
POST /api/auth/otp/send
```

Body:

```json
{
  "mobilePrefix": "+91",
  "mobile": "9876543210"
}
```

Success:

```json
{
  "status": true,
  "message": "OTP sent successfully",
  "data": {
    "expiresInSeconds": 300
  }
}
```

## 2. Resend OTP

```http
POST /api/auth/otp/resend
```

Body:

```json
{
  "mobilePrefix": "+91",
  "mobile": "9876543210"
}
```

Success:

```json
{
  "status": true,
  "message": "OTP resent successfully",
  "data": {
    "expiresInSeconds": 300
  }
}
```

Cooldown response (HTTP 429):

```json
{
  "status": false,
  "message": "Please wait 30 seconds before requesting another OTP",
  "errors": {
    "retryAfter": 30
  }
}
```

## 3. Verify OTP

```http
POST /api/auth/otp/verify
```

Body:

```json
{
  "mobilePrefix": "+91",
  "mobile": "9876543210",
  "otp": "123456"
}
```

Success:

```json
{
  "status": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true,
    "userExists": false,
    "registrationToken": "..."
  }
}
```

`userExists: true` means the frontend should show the already-registered screen instead of continuing to registration.

## 4. Schools

```http
GET /api/schools
```

Success:

```json
{
  "status": true,
  "message": "Schools fetched successfully",
  "data": [
    {
      "id": 1,
      "name": "ABC School"
    }
  ]
}
```

Only active rows from the existing `institutions` table are returned.

## 5. Register

```http
POST /api/auth/register
```

Body:

```json
{
  "registrationToken": "...",
  "name": "Student Name",
  "schoolId": 1,
  "classGrade": "VI",
  "section": "A",
  "rollNo": "25",
  "password": "password123",
  "confirmPassword": "password123"
}
```

Success:

```json
{
  "status": true,
  "message": "Registration completed successfully",
  "data": {
    "user": {
      "id": 101,
      "uuid": "...",
      "name": "Student Name",
      "classGrade": "6",
      "userType": "STUDENT",
      "mobile_prefix": "+91",
      "mobile": "9876543210",
      "schoolName": "ABC School",
      "rollNo": "25",
      "section": "A",
      "status": true,
      "roles": []
    }
  }
}
```

Validation errors use HTTP 422:

```json
{
  "status": false,
  "message": "Validation failed",
  "errors": {
    "confirmPassword": [
      "Password confirmation does not match"
    ]
  }
}
```

Already registered uses HTTP 409:

```json
{
  "status": false,
  "message": "User is already registered",
  "errors": {
    "userExists": [
      "A user is already registered with this mobile number"
    ]
  }
}
```

## Environment

Important values:

```env
DATABASE_HOST=""
DATABASE_PORT="3306"
DATABASE_USER=""
DATABASE_PASSWORD=""
DATABASE_NAME=""

STUDENT_ROLE_SLUG="student"

MSG91_AUTH_KEY=""
MSG91_OTP_TEMPLATE_ID=""
OTP_EXPIRY_MINUTES="5"
OTP_RESEND_SECONDS="30"
OTP_MAX_ATTEMPTS="5"

REGISTRATION_TOKEN_SECRET="replace-with-a-long-random-secret"
REGISTRATION_TOKEN_EXPIRY="15m"

FRONTEND_URL="http://localhost:3000"
PORT="3001"
```
