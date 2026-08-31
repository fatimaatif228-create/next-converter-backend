# Conversion Status Emails — Integration Notes

## Scope note (please read first)

There is no `projects` table in Supabase yet — only `users`. So "project"
data (name, id, output info) is carried directly on the BullMQ job payload
rather than joined from a projects table. The owner's email is still looked
up live from `users` via `SupabaseDbService`, matching the spirit of the
task. When a real `projects` table exists, swap the job-payload project
fields for a lookup keyed on `job.data.projectId` — that's a small, isolated
change inside `conversions.processor.js`.

There's also no real file-conversion logic anywhere yet. `ConversionsProcessor.process()`
is stubbed — it either throws a simulated error (if `job.data.shouldFail` is
true) or returns fake output metadata. Replace the body of `process()` with
real conversion work when that's built.

---

## 1. Install dependencies

```bash
npm install bullmq @nestjs/bullmq
```

## 2. Redis

BullMQ requires Redis. For local development:

```bash
# if you have Docker:
docker run -d -p 6379:6379 redis

# or install Redis directly (varies by OS)
```

Default assumed connection: `localhost:6379`. Override via env vars (added
below) if your Redis runs elsewhere.

## 3. Add Redis config to the Joi schema

In `src/config/config.schema.js`:

```js
REDIS_HOST: Joi.string().default('localhost'),
REDIS_PORT: Joi.number().default(6379),
```

## 4. Add to `configuration.js`

```js
redisHost: process.env.REDIS_HOST || 'localhost',
redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
```

## 5. Add to `.env.example`

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 6. Register BullMQ's root connection in `app.module.js`

This is separate from `ConversionsModule`'s `BullModule.registerQueue(...)` —
`forRootAsync` sets up the shared Redis connection once; `registerQueue`
(already in `conversions.module.js`) registers each named queue against it.

```js
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: configValidationSchema,
      load: [configuration],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService) => ({
        connection: {
          host: configService.get('redisHost'),
          port: configService.get('redisPort'),
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ConversionsModule,
    // ...rest unchanged
  ],
  // ...
})
export class AppModule {}
```

(`ConfigService` needs importing from `@nestjs/config` in `app.module.js` if
it isn't already — check the top of the file.)

## 7. Files to add

Drop these into `src/modules/conversions/`:
- `conversions.processor.js`
- `conversions.controller.js`
- `conversions.module.js` (replaces the current empty scaffold)

## 8. Testing via Swagger

Once running, go to `/api/docs` and find `POST /conversions/test-job`.

**Success case:**
```json
{
  "ownerId": "<a real uuid from your users table>",
  "projectName": "Test Project",
  "conversionId": "conv-abc123",
  "shouldFail": false
}
```
Expect a "Conversion Complete" email shortly after.

**Failure case** (retries exhausted after 3 attempts with exponential backoff):
```json
{
  "ownerId": "<a real uuid from your users table>",
  "projectName": "Broken Project",
  "conversionId": "conv-fail456",
  "shouldFail": true
}
```
Expect a "Conversion Failed" email once all 3 attempts are exhausted — this
will take a few seconds due to the backoff delay between retries. Watch the
server logs for `Job ... failed, retrying (attempt X/3)` lines before the
final failure email fires.

## 9. Known parameter-decorator risk on `GET /conversions/:id/output`

This route is currently a placeholder (throws `NotFoundException` — no real
output storage exists yet). When it's implemented for real, it'll need the
`:id` route param. This project's Babel setup cannot transform `@Param()`
(same root cause as the earlier `@Body()` issue) — so read the id via the
same request-scoped pattern already used elsewhere: inject `REQUEST` via
`@Dependencies()` and read `this.request.params.id` manually, rather than
using `@Param('id')`.
