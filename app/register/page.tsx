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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const labelClass = 'text-xs font-medium uppercase tracking-[0.14em] text-ivory-dim/75';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card px-7 py-9">
        <p className="eyebrow">Membership</p>
        <h1 className="font-display mt-3 text-4xl">Join the house</h1>
        <p className="muted mt-2 text-sm">One account, every chair in the catalog.</p>

        <form
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            try {
              const data = await apiJson<{ user: PublicUser; accessToken: string; refreshToken: string }>(
                '/api/v1/auth/register',
                { method: 'POST', body: JSON.stringify(values) }
              );
              setSession(data.user, data.accessToken, data.refreshToken);
              router.push('/');
            } catch (e) {
              setError((e as Error).message);
            }
          })}
          className="mt-7 grid gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className={labelClass}>First name</span>
              <input {...register('firstName')} placeholder="First name" className="field" />
            </label>
            <label className="grid gap-2">
              <span className={labelClass}>Last name</span>
              <input {...register('lastName')} placeholder="Last name" className="field" />
            </label>
          </div>
          <label className="grid gap-2">
            <span className={labelClass}>Email</span>
            <input {...register('email')} type="email" placeholder="you@example.com" className="field" />
          </label>
          <label className="grid gap-2">
            <span className={labelClass}>Password</span>
            <input
              {...register('password')}
              type="password"
              placeholder="Password (8+ chars)"
              className="field"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-ember">
              {error}
            </p>
          )}
          <button className="btn-primary mt-1 py-3">Open my account</button>
        </form>

        <div className="rule-fade my-7" />
        <p className="text-center text-sm text-ivory-dim">
          Already a member?{' '}
          <Link href="/login" className="font-medium text-brass-300 hover:text-brass-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
