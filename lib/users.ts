import { createClient } from '@supabase/supabase-js';
import { User } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export async function getUsers(): Promise<User[]> {
  const { data } = await supabase.from('users').select('*');
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.password_hash,
    createdAt: u.created_at,
  }));
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .single();
  if (!data) return undefined;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    passwordHash: data.password_hash,
    createdAt: data.created_at,
  };
}

export async function createUser(user: User): Promise<void> {
  await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    name: user.name,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  });
}
