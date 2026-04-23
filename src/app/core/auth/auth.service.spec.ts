import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';

import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildSupabaseStub(profileResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };

  const user = signal<User | null>(null);
  const session = signal<Session | null>(null);

  return {
    stub: {
      user,
      session,
      accessToken: null,
      client: { auth, from },
    } as unknown as SupabaseService,
    mocks: { auth, from, select, eq, maybeSingle, user, session },
  };
}

function setupService(profileResult?: { data: unknown; error: unknown }) {
  const built = buildSupabaseStub(profileResult);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: built.stub }],
  });
  const service = TestBed.inject(AuthService);
  return { service, ...built.mocks };
}

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('signIn', () => {
    it('calls supabase.auth.signInWithPassword with credentials', async () => {
      const { service, auth } = setupService();
      await service.signIn('a@b.com', 'secret');
      expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
    });

    it('throws when supabase returns an error', async () => {
      const { service, auth } = setupService();
      auth.signInWithPassword.mockResolvedValueOnce({ error: new Error('bad creds') });
      await expect(service.signIn('a@b.com', 'x')).rejects.toThrow('bad creds');
    });
  });

  describe('signUp', () => {
    it('calls supabase.auth.signUp with credentials', async () => {
      const { service, auth } = setupService();
      await service.signUp('new@b.com', 'supersecret');
      expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@b.com', password: 'supersecret' });
    });

    it('throws when supabase returns an error', async () => {
      const { service, auth } = setupService();
      auth.signUp.mockResolvedValueOnce({ error: new Error('email taken') });
      await expect(service.signUp('new@b.com', 'x')).rejects.toThrow('email taken');
    });
  });

  describe('recover', () => {
    it('calls resetPasswordForEmail', async () => {
      const { service, auth } = setupService();
      await service.recover('a@b.com');
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      const { service, auth } = setupService();
      await service.signOut();
      expect(auth.signOut).toHaveBeenCalled();
    });
  });

  describe('profile reaction', () => {
    it('loads profile and sets tier/client when user becomes non-null', async () => {
      const { service, user, from } = setupService({
        data: { tier: 'silver', client: 'Acme Corp' },
        error: null,
      });
      user.set({ email: 'a@b.com' } as User);
      TestBed.flushEffects();
      // allow maybeSingle promise to resolve
      await Promise.resolve();
      await Promise.resolve();
      expect(from).toHaveBeenCalledWith('profiles');
      expect(service.tier()).toBe('silver');
      expect(service.client()).toBe('Acme Corp');
    });

    it('defaults to free tier when no profile row exists', async () => {
      const { service, user } = setupService({ data: null, error: null });
      user.set({ email: 'new@b.com' } as User);
      TestBed.flushEffects();
      await Promise.resolve();
      await Promise.resolve();
      expect(service.tier()).toBe('free');
      expect(service.client()).toBeNull();
    });

    it('resets tier/client when user becomes null (sign-out)', () => {
      const { service, user } = setupService();
      user.set({ email: 'a@b.com' } as User);
      TestBed.flushEffects();
      service.tier.set('gold');
      service.client.set('X');

      user.set(null);
      TestBed.flushEffects();

      expect(service.tier()).toBe('free');
      expect(service.client()).toBeNull();
    });
  });
});