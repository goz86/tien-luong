-- =============================================
-- DUHOC MATE - Public monthly income rankings RPC
-- Safe to rerun.
--
-- Why this exists:
-- shift_entries must stay private by RLS, so clients can only read their own
-- shifts. This SECURITY DEFINER function returns only aggregated monthly totals
-- for the leaderboard, without exposing individual shift rows.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_anonymous_rank BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS shift_entries_work_date_user_idx
  ON public.shift_entries(work_date, user_id);

DROP FUNCTION IF EXISTS public.get_monthly_income_rankings(TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_monthly_income_rankings(
  p_start_date TEXT,
  p_end_date TEXT,
  p_current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  month_key TEXT,
  total_income NUMERIC,
  rank INTEGER,
  display_name TEXT,
  is_anonymous_rank BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parsed AS (
    SELECT
      se.user_id,
      se.work_date,
      CASE
        WHEN se.start_time ~ '^[0-2][0-9]:[0-5][0-9]$'
          THEN split_part(se.start_time, ':', 1)::INT * 60 + split_part(se.start_time, ':', 2)::INT
        ELSE NULL
      END AS start_minutes,
      CASE
        WHEN se.end_time ~ '^[0-2][0-9]:[0-5][0-9]$'
          THEN split_part(se.end_time, ':', 1)::INT * 60 + split_part(se.end_time, ':', 2)::INT
        ELSE NULL
      END AS end_minutes,
      GREATEST(COALESCE(se.break_minutes, 0), 0)::NUMERIC AS break_minutes,
      GREATEST(COALESCE(se.hourly_wage, 0), 0)::NUMERIC AS hourly_wage,
      COALESCE(se.night_shift, false) AS night_shift,
      COALESCE(se.tax_deduction, false) AS tax_deduction,
      GREATEST(COALESCE(se.holiday_allowance, 0), 0)::NUMERIC AS holiday_allowance
    FROM public.shift_entries se
    WHERE se.work_date >= p_start_date
      AND se.work_date <= p_end_date
      AND se.user_id IS NOT NULL
  ),
  priced AS (
    SELECT
      parsed.user_id,
      parsed.work_date,
      GREATEST(
        (
          (
            CASE
              WHEN parsed.end_minutes <= parsed.start_minutes THEN parsed.end_minutes + 1440
              ELSE parsed.end_minutes
            END
          ) - parsed.start_minutes - parsed.break_minutes
        ) / 60,
        0
      ) AS hours,
      parsed.hourly_wage,
      parsed.night_shift,
      parsed.tax_deduction,
      parsed.holiday_allowance
    FROM parsed
    WHERE parsed.start_minutes IS NOT NULL
      AND parsed.end_minutes IS NOT NULL
      AND parsed.hourly_wage > 0
  ),
  totals AS (
    SELECT
      priced.user_id,
      SUM(
        GREATEST(
          (
            (priced.hours * priced.hourly_wage * CASE WHEN priced.night_shift THEN 1.5 ELSE 1 END)
            + priced.holiday_allowance
          ) * CASE WHEN priced.tax_deduction THEN 0.967 ELSE 1 END,
          0
        )
      ) AS total_income
    FROM priced
    WHERE priced.hours > 0
    GROUP BY priced.user_id
  ),
  ranked AS (
    SELECT
      totals.user_id,
      left(p_start_date, 7) AS month_key,
      ROUND(totals.total_income) AS total_income,
      RANK() OVER (ORDER BY totals.total_income DESC)::INTEGER AS rank
    FROM totals
    WHERE totals.total_income > 0
  )
  SELECT
    ranked.user_id,
    ranked.month_key,
    ranked.total_income,
    ranked.rank,
    COALESCE(NULLIF(profiles.display_name, ''), 'Ẩn danh') AS display_name,
    COALESCE(profiles.is_anonymous_rank, false) AS is_anonymous_rank
  FROM ranked
  LEFT JOIN public.profiles profiles ON profiles.id = ranked.user_id
  WHERE ranked.rank <= 3
     OR (p_current_user_id IS NOT NULL AND ranked.user_id = p_current_user_id)
  ORDER BY ranked.rank ASC, ranked.total_income DESC;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_income_rankings(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_income_rankings(TEXT, TEXT, UUID) TO authenticated;
