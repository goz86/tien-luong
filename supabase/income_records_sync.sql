-- Persist Income tab calculators: insurance records and 주휴수당 records.

CREATE TABLE IF NOT EXISTS public.insurance_records (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month TEXT NOT NULL,
  workplace_label TEXT DEFAULT '',
  work_start_date TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  insurance_type TEXT NOT NULL DEFAULT '4',
  health_rate NUMERIC DEFAULT 0,
  long_care_rate NUMERIC DEFAULT 0,
  pension_rate NUMERIC DEFAULT 0,
  employment_rate NUMERIC DEFAULT 0,
  health_amt NUMERIC DEFAULT 0,
  long_care_amt NUMERIC DEFAULT 0,
  pension_amt NUMERIC DEFAULT 0,
  employment_amt NUMERIC DEFAULT 0,
  confirmed BOOLEAN DEFAULT false,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.insurance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own insurance records." ON public.insurance_records;
CREATE POLICY "Users can view their own insurance records." ON public.insurance_records FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own insurance records." ON public.insurance_records;
CREATE POLICY "Users can insert their own insurance records." ON public.insurance_records FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own insurance records." ON public.insurance_records;
CREATE POLICY "Users can update their own insurance records." ON public.insurance_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own insurance records." ON public.insurance_records;
CREATE POLICY "Users can delete their own insurance records." ON public.insurance_records FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS insurance_records_user_month_idx ON public.insurance_records(user_id, month);

CREATE TABLE IF NOT EXISTS public.juhyu_records (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month TEXT NOT NULL,
  workplace_label TEXT DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  hourly_rate NUMERIC DEFAULT 0,
  juhyu_hours_per_week NUMERIC DEFAULT 0,
  juhyu_per_week NUMERIC DEFAULT 0,
  juhyu_per_month NUMERIC DEFAULT 0,
  weeks JSONB DEFAULT '[]'::jsonb,
  qualifies BOOLEAN DEFAULT false,
  confirmed BOOLEAN DEFAULT false,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.juhyu_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own juhyu records." ON public.juhyu_records;
CREATE POLICY "Users can view their own juhyu records." ON public.juhyu_records FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own juhyu records." ON public.juhyu_records;
CREATE POLICY "Users can insert their own juhyu records." ON public.juhyu_records FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own juhyu records." ON public.juhyu_records;
CREATE POLICY "Users can update their own juhyu records." ON public.juhyu_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own juhyu records." ON public.juhyu_records;
CREATE POLICY "Users can delete their own juhyu records." ON public.juhyu_records FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS juhyu_records_user_month_idx ON public.juhyu_records(user_id, month);
