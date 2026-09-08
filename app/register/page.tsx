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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="mx-auto max-w-sm">
      <div className="card">
        <h1 className="font-display mb-1 text-2xl">Join the house</h1>
        <p className="mb-4 text-sm text-bark">One account, every chair in the catalog.</p>
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
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input {...register('firstName')} placeholder="First name" className="field" />
            <input {...register('lastName')} placeholder="Last name" className="field" />
          </div>
          <input {...register('email')} type="email" placeholder="Email" className="field" />
          <input {...register('password')} type="password" placeholder="Password (8+ chars)" className="field" />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary">Open my account</button>
        </form>
      </div>
    </div>
  );
}
