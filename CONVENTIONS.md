# Backend Conventions

This document defines naming conventions for the NestJS backend.

## File Naming

Use lowercase kebab-case for file names.

Examples:

```text
auth.module.js
users.controller.js
projects.service.js
conversions.module.js
```

Feature files should follow this pattern:

```text
<feature>.module.js
<feature>.controller.js
<feature>.service.js
```

## Folder Naming

Use lowercase plural names for feature folders.

```text
modules/
├── users/
├── projects/
├── teams/
└── conversions/
```

Use singular names for shared folders.

```text
common/
config/
prisma/
```

## Class Naming

Use PascalCase for class names.

```js
export class AuthModule {}
export class UsersController {}
export class ProjectsService {}
```

## Route Naming

Use lowercase plural nouns for routes.

```text
/users
/projects
/teams
/conversions
```

Use HTTP methods to describe actions.

```text
GET /users
POST /users
GET /users/:id
PATCH /users/:id
DELETE /users/:id
```

Avoid action words in routes.

```text
Bad:
GET /getUsers
POST /createUser
DELETE /deleteUser

Good:
GET /users
POST /users
DELETE /users/:id
```

## Module Structure

Each feature should be placed inside `src/modules`.

```text
src/modules/users/
├── users.module.js
├── users.controller.js
└── users.service.js
```

## General Rules

- Keep feature-specific code inside its feature folder.
- Keep shared reusable code inside `common/`.
- Keep environment/config code inside `config/`.
- Keep database-related setup inside `prisma/`.
- Use clear names over short or vague names.

## Swagger Documentation

All new API endpoints must include Swagger decorators.

Every controller endpoint should include:

```js
@ApiTags('SectionName')
@ApiOperation({ summary: 'Short description of what this endpoint does' })
@ApiResponse({ status: 200, description: 'Successful response description' })
```

For endpoints that require authentication, also include:

```js
@ApiBearerAuth()
```

Example:

```js
@ApiTags('Health')
@ApiOperation({ summary: 'Check API health status' })
@ApiResponse({ status: 200, description: 'API is healthy' })
@Get('health')
getHealth() {
  return { status: 'ok' };
}
```

This rule ensures Swagger stays accurate and all endpoints are easy to understand and test.


## Role-Based Access Control

Use `@Roles(...)` to define which organization roles are allowed to access a route.

Example:

```js
@Get('role-test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
roleTest() {
  return {
    message: 'You have OWNER access',
  };
}