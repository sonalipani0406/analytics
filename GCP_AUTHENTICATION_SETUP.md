# GCP OAuth2 Authentication Setup Guide

## Overview
This analytics dashboard now uses Google Cloud Platform (GCP) OAuth2 authentication with email domain restriction (@rbg.iitm.ac.in).

## Prerequisites
1. Google Cloud Project with OAuth2 credentials set up
2. GCP Client ID for web application
3. JWT Secret key for session management

## Backend Setup

### Environment Variables
Add the following to `.env` file in the backend directory:

```env
GCP_CLIENT_ID=your-gcp-client-id-here.apps.googleusercontent.com
JWT_SECRET_KEY=your-secret-key-change-in-production
```

### Python Dependencies
The following packages have been added to `requirements.txt`:
- `google-auth==2.33.0`
- `google-auth-oauthlib==1.2.0`
- `google-auth-httplib2==0.2.0`
- `PyJWT==2.10.1`

### Authentication Endpoints
Three new endpoints have been created:

#### 1. `/api/auth/login` (POST)
Exchange GCP ID token for JWT token
- **Request**: `{"token": "<gcp_id_token>"}`
- **Response**: 
  ```json
  {
    "success": true,
    "token": "jwt_token_here",
    "user": {
      "email": "user@rbg.iitm.ac.in",
      "name": "User Name",
      "picture": "https://..."
    }
  }
  ```
- **Restrictions**: Only @rbg.iitm.ac.in emails allowed

#### 2. `/api/auth/verify` (GET)
Verify current JWT token validity
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: User info if token is valid
- **Status**: 401 if token invalid/expired

#### 3. `/api/auth/logout` (POST)
Endpoint for logout (token invalidation handled client-side)
- **Headers**: `Authorization: Bearer <jwt_token>`

### Protected Routes
All analytics endpoints now require JWT token:
- `/api/analytics` - requires `Authorization: Bearer <token>` header
- Add `@token_required` decorator to any new protected endpoints

## Frontend Setup

### Environment Variables
Add to `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_GCP_CLIENT_ID=your-gcp-client-id-here.apps.googleusercontent.com
```

### Components
New authentication components have been created:

#### 1. Login Page (`src/app/login/page.tsx`)
- Displays Google Sign-In button
- Handles credential response from Google
- Exchanges credentials for JWT token
- Stores token in localStorage
- Redirects to dashboard on success

#### 2. Protected Route Wrapper (`src/components/protected-route.tsx`)
- Wraps entire app in route protection
- Checks for valid JWT token on route access
- Redirects to login if token missing/invalid
- Provides loading state during auth check
- Added to root layout

#### 3. Updated Header (`src/components/header.tsx`)
- Shows logged-in user info (name/email)
- User dropdown menu with logout option
- Displays user picture if available

### Auth Flow
1. User navigates to dashboard
2. ProtectedRoute checks for valid token
3. If no token: redirect to `/login`
4. User clicks Google Sign-In button
5. Google opens sign-in dialog
6. User authenticates with Google
7. Google returns ID token
8. Frontend sends token to `/api/auth/login`
9. Backend verifies token and email domain
10. Backend returns JWT token
11. Frontend stores JWT and redirects to dashboard
12. All API requests include JWT in Authorization header

## GCP Project Setup Steps

### 1. Create GCP Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project

### 2. Enable OAuth 2.0
- Go to APIs & Services → OAuth consent screen
- Choose "External" user type
- Fill in application name and support email
- Add scopes: `profile`, `email`

### 3. Create OAuth Credentials
- Go to APIs & Services → Credentials
- Click "Create Credentials" → OAuth 2.0 Client IDs
- Select "Web application"
- Add authorized JavaScript origins:
  - `http://localhost:3000` (local development)
  - `http://localhost:5000` (local development)
  - `https://yourdomain.com` (production)
- Add authorized redirect URIs:
  - `http://localhost:3000/login` (local development)
  - `http://localhost:5000/login` (local development)
  - `https://yourdomain.com/login` (production)
- Copy the Client ID

### 4. Add to Environment
- Backend: `GCP_CLIENT_ID` in `.env`
- Frontend: `NEXT_PUBLIC_GCP_CLIENT_ID` in `.env.local`

## Security Considerations

### Email Domain Validation
- Only @rbg.iitm.ac.in emails are allowed
- Validation happens in backend (`auth_config.py`)
- User receives 403 error if email domain doesn't match

### JWT Token
- 24-hour expiration time (configurable)
- Signed with `JWT_SECRET_KEY` (change in production)
- Stored in browser localStorage
- Included in Authorization header for API requests

### CORS & HTTPS
- Enable HTTPS in production (critical for OAuth2)
- CORS headers configured for API endpoints
- OPTIONS method supported for preflight requests

## Token Expiration & Refresh

Current implementation uses 24-hour JWT tokens. For production:

1. **Implement Refresh Tokens**:
   Add refresh token endpoint that returns new JWT

2. **Client-Side Token Refresh**:
   Check token expiration before API request
   Automatically refresh if expired

3. **Example Code**:
   ```typescript
   const getValidToken = async () => {
     const token = localStorage.getItem("authToken");
     const payload = JSON.parse(atob(token.split('.')[1]));
     
     if (payload.exp * 1000 < Date.now()) {
       // Token expired, refresh it
       const newToken = await fetch("/api/auth/refresh", {
         method: "POST",
         headers: { "Authorization": `Bearer ${token}` }
       });
       localStorage.setItem("authToken", newToken.token);
     }
     return token;
   };
   ```

## Testing the Authentication

### Local Testing
1. Start backend: `python app.py` or `gunicorn app:app`
2. Start frontend: `npm run dev` or `pnpm dev`
3. Navigate to `http://localhost:3000`
4. Should redirect to `/login`
5. Click Google Sign-In button
6. Sign in with @rbg.iitm.ac.in account
7. Should redirect to dashboard with analytics data

### Testing Non-Allowed Emails
- Try signing in with non-@rbg.iitm.ac.in email
- Should see error: "Email domain not allowed"

### Testing Token Expiration
- Modify JWT token expiration in `auth_config.py` to 10 seconds
- Sign in and verify you're redirected after 10s
- Revert expiration back to 24 hours

## Production Deployment

### Before Going Live
1. [ ] Change `JWT_SECRET_KEY` to strong random string
2. [ ] Generate GCP Client ID for production domain
3. [ ] Update redirect URIs in GCP console
4. [ ] Enable HTTPS on domain
5. [ ] Add production domain to CORS origins
6. [ ] Test full auth flow in production environment
7. [ ] Set up token refresh mechanism
8. [ ] Configure secure cookie settings

### Database & Logging
- Consider storing user login logs in database
- Add audit trail for authentication events
- Monitor failed login attempts

## Troubleshooting

### "Invalid GCP token" Error
- Verify `GCP_CLIENT_ID` matches in backend and frontend
- Check token isn't expired (Google tokens expire quickly)
- Ensure request includes full token value

### "Email domain not allowed" Error
- Verify email is using @rbg.iitm.ac.in domain
- Check domain comparison is case-insensitive in code
- Verify no typos in domain configuration

### Token Not Found Error
- Clear localStorage and try again
- Check browser DevTools → Application → Storage
- Verify token is being saved after login

### CORS Errors
- Check backend CORS configuration
- Verify frontend origin is in allowed list
- Ensure OPTIONS method is supported

## API Request Examples

### With cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "gcp_id_token_here"}'

# Verify token
curl -X GET http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer jwt_token_here"

# Get analytics (with auth)
curl -X GET "http://localhost:5000/api/analytics?period=day" \
  -H "Authorization: Bearer jwt_token_here"
```

### With JavaScript
```javascript
const token = localStorage.getItem("authToken");
const response = await fetch("/api/analytics", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});
```

## Support & Maintenance

- Regularly update Google Auth libraries
- Monitor GCP quota usage
- Review authentication logs
- Keep JWT_SECRET_KEY secure
- Update email domain whitelist if needed
