# Help Desk Backend (NestJS Learning Project)

A small help desk API built with [NestJS](https://nestjs.com/). Users can create support tickets, list and filter them, update them, and staff members can close them.

This README is also a **learning document**. It explains every NestJS concept used in this project, what each file does, which libraries we used and why, and every bug we hit along the way with how we fixed it. It is written for beginner backend developers.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Libraries We Use and Why](#2-libraries-we-use-and-why)
3. [Project Structure](#3-project-structure)
4. [How a Request Travels Through NestJS](#4-how-a-request-travels-through-nestjs)
5. [Core Concepts, Explained With Our Code](#5-core-concepts-explained-with-our-code)
6. [API Reference](#6-api-reference)
7. [Testing the API](#7-testing-the-api)
8. [Change Log: What We Changed and Why](#8-change-log-what-we-changed-and-why)
9. [Known Limitations and Next Steps](#9-known-limitations-and-next-steps)
10. [Useful Commands Cheat Sheet](#10-useful-commands-cheat-sheet)
11. [Glossary](#11-glossary)
12. [Resources](#12-resources)

---

## 1. Quick Start

### Requirements

- **Node.js** 22 or newer (we used `v22.22.3`)
- **npm** 10 or newer (we used `10.9.8`)

### Get the code

```bash
git clone https://github.com/<your-username>/help-desk-backend.git
cd help-desk-backend
```

### Install dependencies

```bash
npm install --legacy-peer-deps
```

> **Why `--legacy-peer-deps`?** A plain `npm install` crashed with
> `Cannot read properties of null (reading 'edgesOut')`. This is a bug inside npm's
> dependency resolver, triggered while resolving `vitest`'s optional peer packages.
> The flag tells npm to skip strict peer-dependency resolution, and the install then works.
> See [Change Log #1](#change-1-npm-install-crashed).

### Run the server

```bash
# development mode with auto-reload on file save (use this while coding)
npm run start:dev

# normal start (no auto-reload)
npm run start

# production: build first, then run the compiled JavaScript
npm run build
npm run start:prod
```

The server starts at **http://localhost:3000**. Every route starts with `/api`, for example:

```
http://localhost:3000/api/tickets
```

To use a different port:

```bash
PORT=3001 npm run start:dev
```

### Check your code

```bash
npx tsc --noEmit    # type check only, no output files
npm run lint        # run the linter (oxlint)
npm run format      # auto-format code with Prettier
```

---

## 2. Libraries We Use and Why

### Runtime dependencies (needed when the app runs)

| Library | What it does | Why we need it |
|---|---|---|
| `@nestjs/core` | The NestJS engine: builds modules, runs dependency injection, routes requests | The framework itself |
| `@nestjs/common` | Decorators and helpers: `@Controller`, `@Get`, `@Injectable`, `ValidationPipe`, `NotFoundException`, and more | Almost every file imports from here |
| `@nestjs/platform-express` | Runs NestJS on top of **Express** (the HTTP server) | NestJS needs an HTTP server underneath |
| `class-validator` | Validation decorators like `@IsString()`, `@IsIn()`, `@IsOptional()` | Checks that request data is correct before it reaches our code |
| `class-transformer` | Turns plain JSON objects into class instances | `ValidationPipe` needs it to apply `class-validator` rules |
| `reflect-metadata` | Lets TypeScript decorators store extra information at runtime | NestJS uses it for dependency injection |
| `rxjs` | Reactive streams (`Observable`, `map`) | Interceptors work with `Observable` streams |

### Development dependencies (only needed while coding)

| Library | What it does |
|---|---|
| `@nestjs/cli` | The `nest` command: `nest start`, `nest build`, `nest generate` |
| `@nestjs/schematics` | Templates that `nest generate` uses to create files |
| `@nestjs/testing` | Helpers for writing NestJS tests |
| `typescript` | The TypeScript compiler |
| `@types/express`, `@types/node` | Type definitions so TypeScript understands Express and Node.js |
| `vitest`, `@vitest/coverage-v8` | Test runner and code coverage |
| `supertest` | Sends fake HTTP requests in tests |
| `oxlint` | A very fast linter that finds code problems |
| `prettier` | Auto-formats code so it looks consistent |

---

## 3. Project Structure

```
help-desk-backend/
├── src/
│   ├── main.ts                          # Entry point: creates and starts the app
│   ├── app.module.ts                    # Root module: connects all feature modules
│   ├── common/
│   │   └── response.interceptor.ts      # Wraps every successful response
│   └── tickets/                         # The "tickets" feature
│       ├── tickets.module.ts            # Groups controller + service, applies middleware
│       ├── tickets.controller.ts        # Defines the HTTP routes
│       ├── tickets.service.ts           # Business logic and data storage
│       ├── common/
│       │   └── request-logger.middleware.ts  # Logs every request
│       ├── guards/
│       │   └── staff.guard.ts           # Lets only staff close tickets
│       └── dto/
│           ├── ticket.interface.ts      # The shape of a Ticket
│           ├── create-ticket.dto.ts     # Validation rules for POST
│           ├── update-ticket.dto.ts     # Validation rules for PATCH
│           └── filter-tickets-query.dto.ts  # Validation rules for ?status=&priority=
├── package.json        # Dependencies and npm scripts
├── tsconfig.json       # TypeScript settings
├── nest-cli.json       # Nest CLI settings
└── .oxlintrc.json      # Linter settings
```

**Rule of thumb:** one folder per feature (`tickets/`). Everything about tickets lives inside it. When we add users later, we create a `users/` folder with the same structure.

---

## 4. How a Request Travels Through NestJS

When a request like `PATCH /api/tickets/4/close` arrives, NestJS passes it through these layers **in this exact order**:

```
Client request
   │
   ▼
1. Middleware       RequestLoggerMiddleware  → prints "PATCH /api/tickets/4/close"
   │
   ▼
2. Guard            StaffGuard               → is x-staff-key correct? If not, stop with 401/403
   │
   ▼
3. Interceptor      ResponseInterceptor      → (before) nothing to do yet
   │
   ▼
4. Pipe             ParseIntPipe / ValidationPipe → convert "4" to 4, validate body/query
   │
   ▼
5. Controller       TicketsController.closeTicket()
   │
   ▼
6. Service          TicketsService.closeTicket()   → the real work
   │
   ▼
7. Interceptor      ResponseInterceptor      → (after) wrap result in { success, message, data }
   │
   ▼
Response sent to client
```

If any step throws an error (for example `NotFoundException`), NestJS skips the rest and sends an error response right away.

**Why this matters:** each layer has one job. Logging does not belong in the controller, and permission checks do not belong in the service. Keeping them separate makes code easier to read, test, and reuse.

---

## 5. Core Concepts, Explained With Our Code

### 5.1 `main.ts`: the entry point

```ts
const app = await NestFactory.create(AppModule, {});
app.setGlobalPrefix('api');
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
app.useGlobalInterceptors(new ResponseInterceptor());
await app.listen(process.env.PORT ?? 3000);
```

| Line | Meaning |
|---|---|
| `NestFactory.create(AppModule)` | Build the app starting from the root module |
| `setGlobalPrefix('api')` | Every route starts with `/api`. So `@Controller('tickets')` becomes `/api/tickets` |
| `useGlobalPipes(new ValidationPipe(...))` | Validate **every** request body and query using our DTOs |
| `whitelist: true` | Remove any field that is not defined in the DTO |
| `forbidNonWhitelisted: true` | Instead of silently removing unknown fields, return **400 Bad Request** |
| `useGlobalInterceptors(...)` | Apply `ResponseInterceptor` to every route |
| `process.env.PORT ?? 3000` | Use the `PORT` environment variable, or 3000 if it is not set |

### 5.2 Modules: organizing the app

A **module** groups related code. Every NestJS app has one root module, and the root module imports feature modules.

```ts
// app.module.ts (root module)
@Module({
  imports: [TicketsModule],
})
export class AppModule {}
```

```ts
// tickets.module.ts (feature module)
@Module({
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes(TicketsController);
  }
}
```

- `controllers`: classes that handle HTTP routes
- `providers`: classes NestJS can create and inject, such as services
- `configure()`: where we attach middleware to routes

### 5.3 Controllers: handling routes

A **controller** receives HTTP requests and returns responses. It should stay thin and pass the real work to a service.

```ts
@Controller('tickets')            // base path: /api/tickets
export class TicketsController {
  @Get()                          // GET /api/tickets
  findAll(@Query() query: FilterTicketsQueryDto) { ... }

  @Get(':id')                     // GET /api/tickets/5
  findOne(@Param('id', ParseIntPipe) id: number) { ... }

  @Post()                         // POST /api/tickets
  create(@Body() newTicket: CreateTicketDto) { ... }

  @Patch(':id')                   // PATCH /api/tickets/5
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTicketDto) { ... }

  @UseGuards(StaffGuard)          // only staff
  @Patch(':id/close')             // PATCH /api/tickets/5/close
  closeTicket(@Param('id', ParseIntPipe) id: number) { ... }
}
```

| Decorator | Reads from |
|---|---|
| `@Param('id')` | The URL path: `/tickets/5` gives `"5"` |
| `@Query()` | The query string: `?status=open` gives `{ status: 'open' }` |
| `@Body()` | The JSON body of POST and PATCH requests |

### 5.4 Services and dependency injection

A **service** holds the business logic: finding, creating, updating, and closing tickets. It is marked with `@Injectable()` so NestJS can create it and give it to other classes. This is called **dependency injection (DI)**.

```ts
@Injectable()
export class TicketsService { ... }
```

The controller receives the service like this:

```ts
@Inject(TicketsService)
private readonly ticketsService: TicketsService;
```

This is **property injection**. The more common style is **constructor injection**, which does the same thing:

```ts
constructor(private readonly ticketsService: TicketsService) {}
```

Both work. Constructor injection is the standard style in most NestJS projects.

**Why use DI?** The controller never writes `new TicketsService()`. NestJS creates **one shared instance** and passes it wherever it is needed. That is why all requests see the same ticket list. It also makes testing easy, because a fake service can be swapped in.

### 5.5 DTOs and validation

A **DTO (Data Transfer Object)** is a class that describes what data a request must contain. With `class-validator` decorators, NestJS checks the data automatically.

```ts
// create-ticket.dto.ts
export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsIn(['low', 'medium', 'high'])
  priority: 'low' | 'medium' | 'high';
}
```

```ts
// update-ticket.dto.ts: every field is optional, because PATCH can change just one field
export class UpdateTicketDto {
  @IsOptional() @IsString() @IsNotEmpty()
  subject?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  description?: string;

  @IsOptional() @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';
}
```

| Decorator | Rule |
|---|---|
| `@IsString()` | Must be a string |
| `@IsNotEmpty()` | Must not be empty (`""` fails) |
| `@IsIn([...])` | Must be one of the listed values |
| `@IsOptional()` | Field may be missing; if present, the other rules still apply |

**Interface vs DTO:** `ticket.interface.ts` is a TypeScript **interface**. It only exists at compile time and cannot validate anything at runtime. DTOs are **classes**, so their decorators still exist when the app runs. That is why validation must use classes, not interfaces.

Notice that `UpdateTicketDto` has **no `status` field**. Because of `forbidNonWhitelisted`, sending `{"status":"closed"}` to `PATCH /tickets/:id` returns 400. The only way to close a ticket is the staff-only `/close` route.

### 5.6 Pipes: transform and validate

A **pipe** runs right before the controller method. It can **transform** input (change its type) or **validate** it (reject bad data).

- **`ParseIntPipe`**: URL parameters are always strings. `ParseIntPipe` turns `"5"` into the number `5`. For `"abc"` it returns **400 Bad Request**.
- **`ValidationPipe`**: checks the body or query against the DTO rules. Registered globally in `main.ts`.

### 5.7 Guards: who is allowed?

A **guard** decides whether a request may continue. It returns `true` to allow the request, or throws an error to block it.

```ts
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const staffkey = request.headers['x-staff-key'];
    if (!staffkey) {
      throw new UnauthorizedException('Unauthorized Only Staff Can Do This Action');
    }
    if (staffkey !== '#staff1234') {
      throw new ForbiddenException('Staff Key is Invalid, Please Check Your Key');
    }
    return true;
  }
}
```

Use it on a route with `@UseGuards(StaffGuard)`.

**401 vs 403**, a common interview question:

- **401 Unauthorized**: "I don't know who you are." No credentials were sent.
- **403 Forbidden**: "I know who you are, but you are not allowed." Credentials were sent but are wrong or not permitted.

### 5.8 Interceptors: wrap the response

An **interceptor** can run code **before and after** the controller. Ours changes every successful response into one consistent shape:

```ts
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: 'Request Successful',
        data,
      })),
    );
  }
}
```

- `next.handle()` runs the controller and returns an RxJS `Observable` of its result.
- `.pipe(map(...))` changes that result before it is sent.

So a controller that returns `{ id: 1, ... }` produces this response:

```json
{ "success": true, "message": "Request Successful", "data": { "id": 1, ... } }
```

Other common uses for interceptors include measuring response time, caching, and hiding fields such as passwords.

### 5.9 Middleware: runs first

**Middleware** runs before guards, pipes, and controllers. It is the same idea as Express middleware.

```ts
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.originalUrl}`);
    next(); // must call next(), otherwise the request hangs forever
  }
}
```

It is attached in `TicketsModule.configure()` and prints lines like `PATCH /api/tickets/4/close` in the terminal.

**Middleware vs interceptor:** middleware does not know which controller method will run, and it cannot see the method's return value. An interceptor knows both. Use middleware for raw request work such as logging, CORS, and parsing cookies.

### 5.10 Exceptions: sending errors

NestJS has built-in exception classes. Throw one and NestJS sends the right status code and JSON.

```ts
throw new NotFoundException(`Ticket with id ${id} not found`);
```

Response:

```json
{ "message": "Ticket with id 999 not found", "error": "Not Found", "statusCode": 404 }
```

| Exception | Status | We use it when |
|---|---|---|
| `BadRequestException` | 400 | Updating or closing a ticket that is already closed |
| `UnauthorizedException` | 401 | No staff key |
| `ForbiddenException` | 403 | Wrong staff key |
| `NotFoundException` | 404 | Ticket id does not exist |

### 5.11 ES modules and the `.js` import extension

In this project, imports look like this:

```ts
import { TicketsService } from './tickets.service.js';
```

The file is `tickets.service.ts`, so why `.js`? Because `package.json` has `"type": "module"` and `tsconfig.json` uses `"module": "nodenext"`. In this ES module mode, Node.js requires the full file extension, and TypeScript expects you to write the extension of the **compiled** file (`.js`). If you write `'./tickets.service'` without the extension, the app fails to start.

---

## 6. API Reference

Base URL: `http://localhost:3000/api`

### Ticket shape

```ts
{
  id: number;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'closed';
  createdAt: string; // ISO date, e.g. "2026-10-29T06:58:55.696Z"
}
```

### Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/tickets` | List tickets (optional filters) | None |
| GET | `/tickets/:id` | Get one ticket | None |
| POST | `/tickets` | Create a ticket | None |
| PATCH | `/tickets/:id` | Update subject, description, or priority | None |
| PATCH | `/tickets/:id/close` | Close a ticket | `x-staff-key` header |

### `GET /tickets`

Optional query parameters:

- `status`: `open` or `closed`
- `priority`: `low`, `medium`, or `high`

```
GET /api/tickets?status=open&priority=high
```

```json
{
  "success": true,
  "message": "Request Successful",
  "data": [
    { "id": 2, "subject": "Ticket 2", "description": "Description 2", "priority": "high", "status": "open", "createdAt": "..." }
  ]
}
```

Errors: an unknown value like `?status=pending` or an unknown parameter like `?foo=bar` returns **400**.

### `GET /tickets/:id`

- **200** with the ticket
- **404** if the id does not exist
- **400** if the id is not a number

### `POST /tickets`

Header: `Content-Type: application/json`

```json
{
  "subject": "Printer broken",
  "description": "Printer on the 3rd floor does not print",
  "priority": "medium"
}
```

- **201 Created** with the new ticket. `id`, `status: "open"`, and `createdAt` are added by the server.
- **400** if a field is missing, empty, or invalid, or if an extra field like `status` is sent

### `PATCH /tickets/:id`

Send only the fields you want to change:

```json
{ "priority": "high" }
```

- **200** with the updated ticket
- **400** if the ticket is already closed, a value is invalid, or `status` is sent
- **404** if the id does not exist

### `PATCH /tickets/:id/close` (staff only)

Header: `x-staff-key: #staff1234`

```json
{
  "success": true,
  "message": "Request Successful",
  "data": {
    "message": "Ticket 4 closed successfully",
    "ticket": { "id": 4, "status": "closed", "...": "..." }
  }
}
```

- **401** if the header is missing
- **403** if the key is wrong
- **400** if the ticket is already closed
- **404** if the id does not exist

---

## 7. Testing the API

Start the server with `npm run start:dev`, then try these `curl` commands. Postman, Insomnia, or the VS Code REST Client work too.

```bash
# list all
curl http://localhost:3000/api/tickets

# filter
curl "http://localhost:3000/api/tickets?status=open&priority=high"

# get one
curl http://localhost:3000/api/tickets/1

# create
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"subject":"Printer broken","description":"3rd floor","priority":"medium"}'

# update one field
curl -X PATCH http://localhost:3000/api/tickets/4 \
  -H "Content-Type: application/json" \
  -d '{"priority":"high"}'

# close (staff only)
curl -X PATCH http://localhost:3000/api/tickets/4/close \
  -H "x-staff-key: #staff1234"
```

**Tip:** always test the **error cases** too: missing fields, wrong values, missing ids, and missing or wrong keys. A backend is only as good as the way it handles bad input.

We tested **24 cases** (happy paths and error paths) for all five endpoints. All returned the expected status code and body.

---

## 8. Change Log: What We Changed and Why

Each entry describes the **problem**, the **cause**, the **fix**, and the **lesson**.

### Change 1: `npm install` crashed

- **Problem:** `npm install` failed with `Cannot read properties of null (reading 'edgesOut')`.
- **Cause:** a bug in npm's dependency resolver while handling `vitest`'s optional peer dependencies.
- **Fix:** `npm install --legacy-peer-deps`.
- **Lesson:** when npm crashes inside its own code (not yours), read the debug log path it prints. The last lines show which package it was resolving. `--legacy-peer-deps` is a common workaround for peer-dependency problems.

### Change 2: The filter returned wrong results

- **Problem:** `GET /api/tickets?status=open&priority=high` returned a **closed** ticket.
- **Cause:** the priority filter started again from the full list (`this.tickets`) and threw away the status filter result.

  ```ts
  // before (bug)
  tickets = this.tickets.filter((t) => t.status === status);
  tickets = this.tickets.filter((t) => t.priority === priority); // status filter is lost

  // after (fixed)
  tickets = tickets.filter((t) => t.status === status);
  tickets = tickets.filter((t) => t.priority === priority);     // filters the already filtered list
  ```
- **Lesson:** when chaining filters, each step must use the result of the previous step.

### Change 3: Syntax error "Declaration or statement expected"

- **Problem:** TypeScript showed `Declaration or statement expected` at the end of `tickets.service.ts`.
- **Cause:** one extra `}` after the `create()` method closed the class too early, leaving a stray `}` outside it.
- **Fix:** removed the extra brace.
- **Lesson:** this error usually means mismatched braces. Let Prettier format the file (`npm run format`) and the wrong indentation will point to the problem.

### Change 4: Port 3000 was taken by another app

- **Problem:** `http://localhost:3000/api/tickets` returned a Next.js HTML 404 page instead of our API.
- **Cause:** a different project (a Next.js dev server) was already running on port 3000.
- **Fix:** found the process that owned the port and stopped it.

  ```bash
  # Windows: find which process uses port 3000
  netstat -ano | findstr :3000
  # stop it by PID (/T also stops its child processes)
  taskkill /PID <pid> /T /F
  ```

  ```bash
  # macOS / Linux
  lsof -i :3000
  kill <pid>
  ```

  Or run our app on another port: `PORT=3001 npm run start:dev`.
- **Lesson:** if an API returns something unexpected (like HTML), first check **which program** is answering on that port.

### Change 5: Renamed a misspelled file

- **Problem:** the file was named `filter-tickts-query.dto.ts` (missing an "e").
- **Fix:** renamed it to `filter-tickets-query.dto.ts` and updated the import in `tickets.controller.ts`.
- **Lesson:** after renaming a file, search the project for the old name and run `npx tsc --noEmit` to confirm that no import is broken.

### Change 6: Added validation with DTOs

- **Before:** the POST handler used `@Body() ticket: any`, so anything was accepted, even `{"priority":"urgent"}` or an empty body.
- **After:** we installed `class-validator` and `class-transformer`, created `CreateTicketDto` and `FilterTicketsQueryDto`, and registered a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`.
- **Lesson:** **never trust client input.** Validate at the edge of your app so the service only ever receives clean data. Avoid `any`, because it turns off TypeScript's help.

### Change 7: Created `UpdateTicketDto` and the PATCH route

- Created `update-ticket.dto.ts` with every field marked `@IsOptional()`, because PATCH means a **partial** update.
- Added the missing imports: `Patch` from `@nestjs/common`, and `UpdateTicketDto` in both the controller and the service.
- **Lesson:** use **PUT** to replace the whole object, and **PATCH** to change only some fields.

### Change 8: PATCH erased fields (`useDefineForClassFields` bug)

- **Problem:** `PATCH /api/tickets/1` with only `{"status":"closed"}` returned a ticket **without** `subject`, `description`, or `priority`. The data was erased.
- **Cause:** `tsconfig.json` targets `ES2023`. With modern targets, TypeScript turns every declared class field (like `subject?: string;`) into a real property set to `undefined`. When `ValidationPipe` created the DTO instance, the fields we did not send existed as `undefined`, and `Object.assign(ticket, dto)` copied those `undefined` values over the real data.
- **Fix:** added `"useDefineForClassFields": false` to `tsconfig.json`. Now fields that are not sent do not exist on the DTO at all.
- **Lesson:** `Object.assign` copies **every** own property, including ones whose value is `undefined`. A safer alternative that does not depend on compiler settings is to copy only defined values:

  ```ts
  const changes = Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  );
  Object.assign(ticket, changes);
  ```

### Change 9: Business rules for closed tickets

- `update()` throws **400** if the ticket is already closed.
- `closeTicket()` throws **400** if the ticket is already closed.
- `status` was removed from `UpdateTicketDto`, so the only way to close a ticket is the staff route.
- **Lesson:** business rules ("a closed ticket cannot change") belong in the **service**, not the controller.

### Change 10: Added a guard, an interceptor, and middleware

- `StaffGuard` protects `PATCH /tickets/:id/close` using the `x-staff-key` header.
- `ResponseInterceptor` gives every successful response the same `{ success, message, data }` shape.
- `RequestLoggerMiddleware` logs every ticket request.
- **Lesson:** cross-cutting concerns (auth, logging, response format) should live in their own layer, not be copied into every route.

### Change 11: Cleaned up the starter project

- Removed the starter `AppController` and `AppService` ("Hello World") and the `@nestjs/observe` instrumentation, keeping `AppModule` as a simple root module that imports `TicketsModule`.
- Switched to `npm run start:dev` (watch mode) so the server restarts on every save.

### Change 12: Renamed the project to `help-desk-backend`

- **Before:** the folder and the `name` in `package.json` were `help-desk-bk`, a short form that is unclear to anyone visiting the repository.
- **After:** both are `help-desk-backend`, and `package.json` now has a `description`.
- **Lesson:** pick a clear, lowercase, hyphen-separated name before pushing to GitHub. The repository name, folder name, and `package.json` name should all match. If you change the name, update `package-lock.json` too (or run `npm install` to regenerate it).

---

## 9. Known Limitations and Next Steps

These are good next exercises:

1. **Data is lost on restart.** Tickets are stored in an array in memory. Next step: use a real database (PostgreSQL with [Prisma](https://www.prisma.io/) or [TypeORM](https://typeorm.io/), or MongoDB with Mongoose).
2. **Error responses have a different shape.** Success responses have `{ success, message, data }`, but errors look like `{ message, error, statusCode }`. Next step: write an **exception filter** (`@Catch()`) that returns `{ success: false, message, ... }`.
3. **The staff key is hardcoded** in `staff.guard.ts`. Next step: move it to an environment variable with `@nestjs/config` and a `.env` file. Later, replace it with real authentication (JWT with `@nestjs/jwt` and Passport).
4. **Two `message` fields on close.** The close response has both `message` and `data.message`. Next step: return just the ticket from `closeTicket()`.
5. **No automated tests.** `npm test` finds no `*.spec.ts` files. Next step: write unit tests for `TicketsService` and e2e tests for the routes with `supertest`.
6. **No API documentation UI.** Next step: add Swagger with `@nestjs/swagger` to get an interactive docs page at `/api/docs`.
7. **No DELETE route.** Next step: add `DELETE /tickets/:id`, protected by `StaffGuard`.
8. **Use `PartialType` for update DTOs.** Install `@nestjs/mapped-types` and write `class UpdateTicketDto extends PartialType(CreateTicketDto) {}` so the rules are not repeated.

---

## 10. Useful Commands Cheat Sheet

### Generate files with the Nest CLI

```bash
nest g module tickets              # tickets.module.ts
nest g controller tickets --no-spec  # tickets.controller.ts (no test file)
nest g service tickets --no-spec   # tickets.service.ts
nest g guard tickets/guards/staff  # staff.guard.ts
nest g interceptor common/response # response.interceptor.ts
nest g middleware common/request-logger
nest g interface tickets/ticket --flat
```

Short aliases: `mo` (module), `co` (controller), `s` (service), `gu` (guard), `itc` (interceptor), `mi` (middleware), `pi` (pipe), `f` (filter), `itf` (interface).

> We first tried `nest g c tickets`, which failed with `Invalid schematic "c"`. The alias for
> controller is `co`, not `c`. Writing the full name (`controller`) always works.

`--flat` creates the file without a new folder. `--no-spec` skips the test file.

### Everyday commands

```bash
npm run start:dev     # run with auto-reload
npx tsc --noEmit      # type check
npm run lint          # lint
npm run format        # format
npm run build         # compile to dist/
```

---

## 11. Glossary

| Term | Simple meaning |
|---|---|
| **API** | A set of URLs that a program (like a frontend) can call to get or change data |
| **Endpoint / Route** | One URL + HTTP method, like `GET /api/tickets` |
| **HTTP methods** | `GET` read, `POST` create, `PUT` replace, `PATCH` partially update, `DELETE` remove |
| **Status code** | Number that tells the result: 2xx success, 4xx client mistake, 5xx server error |
| **Decorator** | A function written with `@` that adds behavior or metadata to a class, method, or parameter |
| **Module** | A group of related controllers and providers |
| **Controller** | Receives requests and returns responses |
| **Service / Provider** | Holds business logic; injected into controllers |
| **Dependency Injection** | The framework creates objects and hands them to the classes that need them |
| **DTO** | A class that defines and validates incoming data |
| **Pipe** | Transforms or validates input before the controller runs |
| **Guard** | Decides whether a request is allowed |
| **Interceptor** | Runs code before and after the controller, often to change the response |
| **Middleware** | Runs first on every matching request, before guards |
| **Exception** | An error you throw that NestJS turns into an HTTP error response |
| **Query parameter** | Data after `?` in a URL, like `?status=open` |
| **Path parameter** | Data inside the URL path, like `5` in `/tickets/5` |
| **Request body** | JSON data sent with POST, PUT, or PATCH |
| **Header** | Extra request information, like `Content-Type` or `x-staff-key` |
| **Watch mode** | The server restarts automatically when you save a file |

---

## 12. Resources

- [NestJS Documentation](https://docs.nestjs.com): start with "Overview", which follows the same order as this README
- [NestJS: Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)
- [class-validator decorators](https://github.com/typestack/class-validator#validation-decorators)
- [MDN: HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [MDN: HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
- [RxJS: `map` operator](https://rxjs.dev/api/operators/map)
- [NestJS official courses](https://courses.nestjs.com/)
