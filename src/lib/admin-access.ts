export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super('Sua sessão não está autenticada ou expirou. Entre novamente.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class AdminPermissionDeniedError extends Error {
  readonly status = 403;

  constructor() {
    super('Sua conta não possui permissão administrativa.');
    this.name = 'AdminPermissionDeniedError';
  }
}

export class AdminRoleCheckError extends Error {
  readonly status = 503;

  constructor() {
    super('Não foi possível verificar as permissões administrativas.');
    this.name = 'AdminRoleCheckError';
  }
}

export class SupabaseServiceUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super('O serviço está temporariamente indisponível.');
    this.name = 'SupabaseServiceUnavailableError';
  }
}

export function isAuthenticationRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  return error.status === 400 || error.status === 401 || error.status === 403;
}

function safeErrorType(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (typeof status === 'number') return `HTTP ${status}`;
  }
  return 'unknown';
}

export function assertAdminRole(result: { data: boolean | null; error: unknown }): void {
  if (result.error) {
    console.error('[Admin auth] Role check failed.', { errorType: safeErrorType(result.error) });
    throw new AdminRoleCheckError();
  }
  if (result.data !== true) throw new AdminPermissionDeniedError();
}

export async function verifyAdminRole(
  checkRole: () => PromiseLike<{ data: boolean | null; error: unknown }>,
): Promise<void> {
  let result: { data: boolean | null; error: unknown };
  try {
    result = await checkRole();
  } catch (error) {
    console.error('[Admin auth] Role check request failed.', { errorType: safeErrorType(error) });
    throw new AdminRoleCheckError();
  }
  assertAdminRole(result);
}

export function getAdminRouteErrorKind(error: unknown):
  | 'authentication'
  | 'permission'
  | 'verification'
  | 'unavailable'
  | 'internal' {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';

  if (name === 'AuthenticationRequiredError' || message === 'Sua sessão não está autenticada ou expirou. Entre novamente.') {
    return 'authentication';
  }
  if (name === 'AdminPermissionDeniedError' || message === 'Sua conta não possui permissão administrativa.') {
    return 'permission';
  }
  if (name === 'AdminRoleCheckError' || message === 'Não foi possível verificar as permissões administrativas.') {
    return 'verification';
  }
  if (name === 'SupabaseServiceUnavailableError' || message === 'O serviço está temporariamente indisponível.') {
    return 'unavailable';
  }
  return 'internal';
}

export function getAdminRouteErrorMessage(error: unknown): string {
  switch (getAdminRouteErrorKind(error)) {
    case 'authentication':
      return 'Sua sessão expirou ou não está válida. Entre novamente para acessar o painel.';
    case 'permission':
      return 'Sua conta está autenticada, mas não possui permissão administrativa.';
    case 'verification':
      return 'Não foi possível verificar sua permissão agora. Tente novamente em instantes.';
    case 'unavailable':
      return 'O serviço está temporariamente indisponível. Tente novamente em instantes.';
    case 'internal':
      return 'Ocorreu um erro ao carregar o painel. Tente novamente em instantes.';
  }
}
