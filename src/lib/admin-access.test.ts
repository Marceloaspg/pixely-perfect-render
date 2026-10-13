import { expect, it, vi } from 'vitest';
import {
  AdminPermissionDeniedError,
  AdminRoleCheckError,
  AuthenticationRequiredError,
  assertAdminRole,
  getAdminRouteErrorKind,
  getAdminRouteErrorMessage,
  isAuthenticationRejection,
  verifyAdminRole,
} from './admin-access';

it('allows an authenticated administrator when the role check succeeds', async () => {
  await expect(verifyAdminRole(async () => ({ data: true, error: null }))).resolves.toBeUndefined();
});

it('denies an authenticated user without the admin role', async () => {
  await expect(verifyAdminRole(async () => ({ data: false, error: null })))
    .rejects.toBeInstanceOf(AdminPermissionDeniedError);
});

it('fails closed and distinguishes errors returned or thrown by has_role', async () => {
  const returnedError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await expect(verifyAdminRole(async () => ({ data: null, error: new Error('database unavailable') })))
      .rejects.toBeInstanceOf(AdminRoleCheckError);
    await expect(verifyAdminRole(async () => { throw new Error('connection failed'); }))
      .rejects.toBeInstanceOf(AdminRoleCheckError);
    expect(returnedError).toHaveBeenCalledTimes(2);
  } finally {
    returnedError.mockRestore();
  }
});

it('keeps write authorization fail-closed when role verification fails', async () => {
  const write = vi.fn();
  await expect(
    verifyAdminRole(async () => ({ data: null, error: new Error('RPC unavailable') })).then(write),
  ).rejects.toBeInstanceOf(AdminRoleCheckError);
  expect(write).not.toHaveBeenCalled();
});

it('classifies authentication, permission, and infrastructure errors separately', () => {
  expect(getAdminRouteErrorKind(new AuthenticationRequiredError())).toBe('authentication');
  expect(getAdminRouteErrorKind(new AdminPermissionDeniedError())).toBe('permission');
  expect(getAdminRouteErrorKind(new AdminRoleCheckError())).toBe('verification');
  expect(getAdminRouteErrorKind(new Error('unexpected database failure'))).toBe('internal');
  expect(getAdminRouteErrorMessage(new AdminRoleCheckError())).toMatch(/Tente novamente/);
});

it('classifies invalid-token responses as authentication failures, not service outages', () => {
  expect(isAuthenticationRejection({ status: 400 })).toBe(true);
  expect(isAuthenticationRejection({ status: 401 })).toBe(true);
  expect(isAuthenticationRejection({ status: 403 })).toBe(true);
  expect(isAuthenticationRejection({ status: 429 })).toBe(false);
  expect(isAuthenticationRejection(new Error('network unavailable'))).toBe(false);
});

it('treats an RPC error as an error rather than as missing admin permission', () => {
  expect(() => assertAdminRole({ data: true, error: new Error('RPC unavailable') }))
    .toThrow(AdminRoleCheckError);
});
