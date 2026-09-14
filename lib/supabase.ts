'use client';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

const { url, anonKey } = getSupabaseConfig(process.env as Record<string, string | undefined>);

export const supabase = createClient(url, anonKey);
