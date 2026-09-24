# Exam Attempts Table Implementation Guide

## Overview

The `exam_attempts` table stores records of all exam submissions by users in the EduPracticeApp. This guide covers creation, schema setup, Row Level Security (RLS), and integration.

## Table Schema

### Creating the Table

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  subject TEXT,
  level TEXT,
  percentage NUMERIC DEFAULT 0,
  breakdown JSONB DEFAULT '[]'::jsonb,
  duration_min INTEGER DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_submitted_at ON exam_attempts(submitted_at DESC);
CREATE INDEX idx_exam_attempts_created_at ON exam_attempts(created_at DESC);
```

## Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier (auto-generated) |
| `user_id` | UUID | Foreign key to authenticated user |
| `exam_id` | TEXT | Identifier for the exam taken |
| `title` | TEXT | Exam title |
| `subtitle` | TEXT | Exam subtitle/description |
| `subject` | TEXT | Subject area (e.g., "Mathematics") |
| `level` | TEXT | Difficulty level (e.g., "Intermediate") |
| `percentage` | NUMERIC | Score as percentage (0-100) |
| `breakdown` | JSONB | Question-by-question results as JSON array |
| `duration_min` | INTEGER | Time taken in minutes |
| `submitted_at` | TIMESTAMP | When the exam was submitted |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Record update timestamp |

## Row Level Security (RLS) Setup

### Enable RLS

```sql
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
```

### Create RLS Policies

#### 1. Users can select their own attempts

```sql
CREATE POLICY "Users can select their own exam attempts"
ON exam_attempts
FOR SELECT
USING (auth.uid() = user_id);
```

#### 2. Users can insert their own attempts

```sql
CREATE POLICY "Users can insert their own exam attempts"
ON exam_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### 3. Users can update their own attempts

```sql
CREATE POLICY "Users can update their own exam attempts"
ON exam_attempts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### 4. Users can delete their own attempts

```sql
CREATE POLICY "Users can delete their own exam attempts"
ON exam_attempts
FOR DELETE
USING (auth.uid() = user_id);
```

#### 5. Admins can read all attempts (optional)

```sql
CREATE POLICY "Admins can read all exam attempts"
ON exam_attempts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);
```

## Frontend Integration

> **Note:** The app now auto-syncs attempts to Supabase on submission. `saveAttempt(attempt, userId)` in [examBank.js](client-ui/src/data/examBank.js) writes to localStorage **and** inserts a row into `exam_attempts` (with `user_id`, `submitted_at`, and the local attempt id stored in `exam_id`). No extra write code is required.

### Writing Exam Attempts

In your exam submission handler:

```javascript
const saveExamAttempt = async (userId, examData) => {
  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({
      user_id: userId,
      exam_id: examData.id,
      title: examData.title,
      subtitle: examData.subtitle,
      subject: examData.subject,
      level: examData.level,
      percentage: examData.score,
      breakdown: examData.answers, // Array of question results
      duration_min: examData.duration,
      submitted_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to save exam attempt:', error);
    return null;
  }
  return data;
};
```

### Reading Exam Attempts

The existing `useAnalyticsData` hook fetches all user's attempts:

```javascript
const { data, error } = await supabase
  .from('exam_attempts')
  .select('*')
  .order('submitted_at', { ascending: false })
  .limit(500);
```

### Real-time Subscriptions

Monitor for new attempts:

```javascript
const channel = supabase
  .channel('analytics_realtime')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'exam_attempts',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('New exam attempt:', payload.new);
      // Update UI here
    }
  )
  .subscribe();
```

## Testing the Setup

### 1. Verify Table Creation

```sql
SELECT * FROM exam_attempts LIMIT 1;
```

Should return column structure (even if empty).

### 2. Test RLS Policies

```sql
-- As authenticated user
SELECT * FROM exam_attempts;
-- Should only show their own records

-- As unauthenticated
SELECT * FROM exam_attempts;
-- Should return error
```

### 3. Insert Test Data

```sql
INSERT INTO exam_attempts (
  user_id, exam_id, title, subject, level, percentage, duration_min
)
VALUES (
  'YOUR_USER_ID', 'exam_001', 'Math Quiz', 'Mathematics', 'Beginner', 85, 30
);
```

## Troubleshooting

### 404 Errors on Queries

**Symptom**: `Failed to load resource: the server responded with a status of 404`

**Causes**:
- Table doesn't exist
- RLS policy blocks all access
- Wrong table name

**Fix**:
1. Verify table exists: `SELECT to_regclass('public.exam_attempts');`
2. Disable RLS temporarily: `ALTER TABLE exam_attempts DISABLE ROW LEVEL SECURITY;`
3. Check policy conditions in Supabase dashboard

### Realtime Subscription Errors

**Symptom**: `cannot add postgres_changes callbacks after subscribe()`

**Fix**: (Already applied in code) Add callbacks before calling `.subscribe()`

```javascript
// ✅ Correct
const channel = supabase
  .channel('name')
  .on('postgres_changes', { ... }, handler)  // Add before
  .subscribe();

// ❌ Wrong
const channel = supabase
  .channel('name')
  .subscribe()
  .on('postgres_changes', { ... }, handler);  // Too late!
```

### Missing Environment Variables

**Symptom**: `VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are not set`

**Fix**: Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Get these from Supabase Dashboard → Settings → API.

## Monitoring & Analytics

### Query Performance

Check slow queries:

```sql
SELECT * FROM pg_stat_statements
WHERE query LIKE '%exam_attempts%'
ORDER BY total_time DESC;
```

### Row Count Monitoring

```sql
SELECT COUNT(*) as total_attempts,
       COUNT(DISTINCT user_id) as unique_users
FROM exam_attempts;
```

### Recent Activity

```sql
SELECT user_id, title, subject, percentage, submitted_at
FROM exam_attempts
ORDER BY submitted_at DESC
LIMIT 20;
```

## Backup & Migration

### Export Data

```bash
# Using Supabase CLI
supabase db pull
```

### Manual Backup SQL

```sql
-- Create backup table
CREATE TABLE exam_attempts_backup AS SELECT * FROM exam_attempts;

-- Export to CSV
COPY exam_attempts TO STDOUT WITH CSV HEADER;
```

## Related Files

- Frontend fetch: [useAnalyticsData.js](client-ui/src/hooks/useAnalyticsData.js)
- Error boundary: [ErrorBoundary.jsx](client-ui/src/components/ErrorBoundary.jsx)
- Analytics page: [Analytics.jsx](client-ui/src/pages/Analytics.jsx)
- Exam runner: [ExamRunner.jsx](client-ui/src/pages/ExamRunner.jsx)

## Next Steps

1. ✅ Create table and indexes
2. ✅ Set up RLS policies
3. ✅ Test with sample data
4. ✅ Configure environment variables
5. ✅ Verify frontend connection
6. ✅ Monitor real-time subscriptions
