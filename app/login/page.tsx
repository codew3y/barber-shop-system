'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import type { PublicUser } from '@/lib/types';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card px-7 py-9">
        <p className="eyebrow">Members</p>
        <h1 className="font-display mt-3 text-4xl">Welcome back</h1>
        <p className="muted mt-2 text-sm">Your chairs are waiting.</p>

        <form
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            try {
              const data = await apiJson<{ user: PublicUser; accessToken: string; refreshToken: string }>(
                '/api/v1/auth/login',
                { method: 'POST', body: JSON.stringify(values) }
              );
              setSession(data.user, data.accessToken, data.refreshToken);
              router.push('/dashboard');
            } catch (e) {
              setError((e as Error).message);
            }
          })}
          className="mt-7 grid gap-4"
        >
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ivory-dim/75">
              Email
            </span>
            <input {...register('email')} type="email" placeholder="you@example.com" className="field" />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-ivory-dim/75">
              Password
            </span>
            <input {...register('password')} type="password" placeholder="••••••••" className="field" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-ember">
              {error}
            </p>
          )}
          <button className="btn-primary mt-1 py-3">Sign in</button>
        </form>

        <div className="rule-fade my-7" />
        <p className="text-center text-sm text-ivory-dim">
          No account yet?{' '}
          <Link href="/register" className="font-medium text-brass-300 hover:text-brass-200">
            Open one
          </Link>
        </p>
      </div>
    </div>
  );
}
