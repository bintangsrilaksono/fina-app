-- Setup pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding VECTOR(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aktivasi RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy access untuk semua diperbolehkan
CREATE POLICY "Permissive rules for all" ON public.transactions
    FOR ALL USING (true);

-- Jika sudah ada sistem auth
-- CREATE POLICY "Users can manage their own transactions" ON public.transactions
--    FOR ALL USING (auth.uid() = user_id);
