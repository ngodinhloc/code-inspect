import { ExtractedEndpoint } from '../types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

// Regex-based, "first pass" detection per PLANS.md Milestone 2 — good enough to
// find the common decorator/handler-registration shapes without a framework-aware
// AST pass. Extend per-framework as false negatives/positives show up.
export function extractApiEndpoints(
  content: string,
  language: string,
): ExtractedEndpoint[] {
  if (language === 'typescript' || language === 'javascript') {
    return [
      ...extractNestJsEndpoints(content),
      ...extractExpressEndpoints(content),
    ];
  }
  if (language === 'go') {
    return extractGoNetHttpEndpoints(content);
  }
  if (language === 'php') {
    return extractLaravelEndpoints(content);
  }
  return [];
}

// @Get('path') / @Post() / ... immediately above a method declaration inside a
// NestJS controller class.
function extractNestJsEndpoints(content: string): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = [];
  const pattern = new RegExp(
    `@(${HTTP_METHODS.map((m) => m[0].toUpperCase() + m.slice(1)).join('|')})\\(\\s*(?:'([^']*)'|"([^"]*)")?\\s*\\)\\s*\\n\\s*(?:\\w+\\s+)*(\\w+)\\s*\\(`,
    'g',
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2] ?? match[3] ?? '/',
      handlerName: match[4],
      framework: 'nestjs',
    });
  }
  return endpoints;
}

// app.get('/path', handler) / router.post("/path", ...) style registrations.
function extractExpressEndpoints(content: string): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = [];
  const pattern = new RegExp(
    `\\b(?:app|router)\\.(${HTTP_METHODS.join('|')})\\(\\s*(?:'([^']*)'|"([^"]*)")`,
    'g',
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2] ?? match[3],
      handlerName: null,
      framework: 'express',
    });
  }
  return endpoints;
}

// http.HandleFunc("/path", handler) / mux.HandleFunc(...) from net/http.
function extractGoNetHttpEndpoints(content: string): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = [];
  const pattern = /\b\w+\.HandleFunc\(\s*"([^"]*)"\s*,\s*(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    endpoints.push({
      method: 'ANY',
      path: match[1],
      handlerName: match[2],
      framework: 'go-net-http',
    });
  }
  return endpoints;
}

// Route::get('/path', ...) / Route::post(...) from Laravel.
function extractLaravelEndpoints(content: string): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = [];
  const pattern = new RegExp(
    `Route::(${HTTP_METHODS.join('|')})\\(\\s*(?:'([^']*)'|"([^"]*)")`,
    'g',
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2] ?? match[3],
      handlerName: null,
      framework: 'laravel',
    });
  }
  return endpoints;
}
