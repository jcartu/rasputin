# Contributing to ALFIE Backend

Thank you for your interest in contributing! This guide helps you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- Git
- OpenClaw gateway (for integration testing)

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/alfie-backend.git
   cd alfie-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Code Style

### JavaScript/ES Modules

- Use ES modules (`import`/`export`)
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw promises
- Destructure when practical

```javascript
// Good
import { Router } from 'express';
const { sessionId, message } = req.body;
const result = await gateway.sendMessage(sessionId, message);

// Avoid
var express = require('express');
const sessionId = req.body.sessionId;
gateway.sendMessage(sessionId, message).then(result => {});
```

### Error Handling

Always handle errors consistently:

```javascript
router.get('/endpoint', async (req, res) => {
  try {
    const result = await someOperation();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Operation failed', 
      details: error.message 
    });
  }
});
```

### Naming Conventions

- Files: `camelCase.js`
- Routes: lowercase with hyphens (`/api/my-route`)
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

## Project Structure

```
src/
├── index.js           # App entry, route mounting
├── config.js          # Environment configuration
├── docs/              # API documentation
├── middleware/        # Express middleware
├── routes/            # Route handlers
└── services/          # Business logic
```

### Adding New Endpoints

1. Create or modify route file in `src/routes/`:
   ```javascript
   import { Router } from 'express';
   
   const router = Router();
   
   router.get('/new-endpoint', async (req, res) => {
     // Implementation
   });
   
   export default router;
   ```

2. Mount in `src/index.js`:
   ```javascript
   import newRouter from './routes/new.js';
   app.use('/api/new', newRouter);
   ```

3. Add OpenAPI documentation in `src/docs/swagger.js`

### Adding Services

Services contain business logic separate from HTTP handling:

```javascript
// src/services/myService.js
export async function performAction(input) {
  // Business logic here
  return result;
}

export default { performAction };
```

## API Documentation

We use OpenAPI 3.0 with Swagger UI. When adding endpoints:

1. Add path definition in `src/docs/swagger.js`
2. Include request/response schemas
3. Add examples for all responses
4. Document error cases

Example:

```javascript
'/api/new-endpoint': {
  get: {
    tags: ['Category'],
    summary: 'Short description',
    description: 'Detailed description',
    operationId: 'uniqueOperationId',
    parameters: [
      {
        name: 'param',
        in: 'query',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ResponseSchema' },
          },
        },
      },
      400: { $ref: '#/components/responses/BadRequest' },
      500: { $ref: '#/components/responses/InternalServerError' },
    },
  },
},
```

## Commit Guidelines

### Message Format

```
type: short description

Optional longer description explaining the change.
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

### Examples

```
feat: add GPU temperature alerts

Adds WebSocket notifications when GPU temp exceeds threshold.
Configurable via GPU_TEMP_ALERT env variable.
```

```
fix: handle missing session gracefully

Return 404 instead of 500 when session not found.
```

## Pull Request Process

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make changes with clear commits

3. Ensure documentation is updated:
   - Update swagger.js for API changes
   - Update README.md if needed

4. Push and create PR:
   ```bash
   git push origin feat/my-feature
   ```

5. Fill out PR template with:
   - Description of changes
   - Testing performed
   - Related issues

## Testing

### Manual Testing

```bash
# Start the server
npm run dev

# Test endpoints
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/sessions -H "Content-Type: application/json" -d '{}'
```

### Using Swagger UI

Navigate to `http://localhost:3001/api/docs` for interactive testing.

## Reporting Issues

When reporting bugs, include:

1. Description of the issue
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment (Node version, OS)
5. Relevant logs

## Questions?

Open a discussion or issue for:
- Feature requests
- Implementation questions
- Documentation improvements

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
