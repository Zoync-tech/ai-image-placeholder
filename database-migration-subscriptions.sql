-- Migration script to add subscription features to existing database
-- This script only adds new tables and columns, preserving existing data

-- Add new columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits_expire_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL, -- active, canceled, past_due, etc.
  plan_type TEXT NOT NULL, -- basic, premium
  price_id TEXT NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- subscription, refill, usage, expiration
  amount INTEGER NOT NULL, -- positive for credits added, negative for credits used
  description TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stripe_prices table for price reference
CREATE TABLE IF NOT EXISTS public.stripe_prices (
  id SERIAL PRIMARY KEY,
  plan_type TEXT NOT NULL,
  price_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_prices_plan_type ON public.stripe_prices(plan_type);

-- Row Level Security Policies for new tables

-- Subscriptions: Users can only see their own subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Users can view own subscriptions'
    ) THEN
        CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Users can insert own subscriptions'
    ) THEN
        CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Users can update own subscriptions'
    ) THEN
        CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
        FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Credit Transactions: Users can only see their own transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'credit_transactions' 
        AND policyname = 'Users can view own credit transactions'
    ) THEN
        CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'credit_transactions' 
        AND policyname = 'Users can insert own credit transactions'
    ) THEN
        CREATE POLICY "Users can insert own credit transactions" ON public.credit_transactions
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Function to add credits to user account
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_subscription_id UUID DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update user credits
  UPDATE public.profiles 
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id, 
    subscription_id, 
    type, 
    amount, 
    description, 
    stripe_payment_intent_id
  ) VALUES (
    p_user_id, 
    p_subscription_id, 
    'credit_added', 
    p_amount, 
    p_description, 
    p_stripe_payment_intent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use credits
CREATE OR REPLACE FUNCTION public.use_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Check if user has enough credits
  IF current_credits < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Update user credits
  UPDATE public.profiles 
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id, 
    type, 
    amount, 
    description
  ) VALUES (
    p_user_id, 
    'credit_used', 
    -p_amount, 
    p_description
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire credits at end of billing period
CREATE OR REPLACE FUNCTION public.expire_credits()
RETURNS VOID AS $$
BEGIN
  -- Reset credits for users whose subscription period has ended
  UPDATE public.profiles 
  SET credits = 0,
      credits_expire_at = NULL,
      updated_at = NOW()
  WHERE credits_expire_at IS NOT NULL 
    AND credits_expire_at < NOW();
  
  -- Log the expiration
  INSERT INTO public.credit_transactions (
    user_id, 
    type, 
    amount, 
    description
  )
  SELECT 
    id, 
    'expiration', 
    -credits, 
    'Credits expired at end of billing period'
  FROM public.profiles 
  WHERE credits_expire_at IS NOT NULL 
    AND credits_expire_at < NOW()
    AND credits > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_subscriptions_updated_at'
    ) THEN
        CREATE TRIGGER update_subscriptions_updated_at
        BEFORE UPDATE ON public.subscriptions
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Add unique constraint to stripe_prices for plan_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_plan_type'
    ) THEN
        ALTER TABLE public.stripe_prices 
        ADD CONSTRAINT unique_plan_type UNIQUE (plan_type);
    END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully! New subscription features have been added to your database.';
END $$;
