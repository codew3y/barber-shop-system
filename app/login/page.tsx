'use client';

import { useState } from 'react';
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
    <div className="mx-auto max-w-sm">
      <div className="card">
        <h1 className="font-display mb-1 text-2xl">Welcome back</h1>
        <p className="mb-4 text-sm text-cream/60">Your chairs are waiting.</p>
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
          className="grid gap-3"
        >
          <input {...register('email')} type="email" placeholder="Email" className="field" />
          <input {...register('password')} type="password" placeholder="Password" className="field" />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary">Sign in</button>
        </form>
      </div>
    </div>
  );
}
