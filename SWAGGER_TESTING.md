# Swagger Testing Guide

This guide explains how interns can use Swagger to view and test the Repress API.

## 1. Start the Backend

From the `repress-api` folder, run:

```bash
npm run start:dev
```

The backend should start on:

```txt
http://localhost:3000
```

## 2. Open Swagger Docs

Open this URL in your browser:

```txt
http://localhost:3000/api/docs
```

Swagger shows the available API endpoints, request methods, expected inputs, and possible responses.

## 3. Test the Health Endpoint

Find the **Health** section.

Open:

```txt
GET /health
```

Click **Try it out**, then click **Execute**.

Expected response:

```json
{
  "status": "ok"
}
```

This confirms the backend is running correctly.

## 4. Using Swagger Authorization

Some future endpoints may require authentication.

To test protected endpoints, click the **Authorize** button in Swagger.

Paste a Supabase access token into the Bearer auth field.

The token should come from logging in with a Supabase test user.

Example token format:

```txt
eyJhbGciOi...
```

Swagger will send the token with future requests as:

```txt
Authorization: Bearer <access_token>
```

## 5. Getting a Supabase Test Token

Use the Supabase Auth API to log in with a test user:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test_password"
  }'
```

The response should include:

```json
{
  "access_token": "..."
}
```

Copy the `access_token` value and paste it into Swagger Authorize.

## 6. Current Auth Testing Status

Swagger Bearer Auth is configured.

However, full protected-route testing requires:

```txt
1. A protected NestJS endpoint
2. A Supabase JWT guard/middleware
3. A valid Supabase access token
```

Until a protected endpoint and JWT verification are added, Swagger can store the token, but there is no protected route to fully test yet.

## 7. Notes

* Swagger is for API documentation and simple browser-based testing.
* Postman can also be used for API testing.
* Swagger is useful because it automatically lists backend routes and expected responses.
* Do not commit real access tokens, API keys, or passwords.
* Use test users only.
