# Secure Authentication System Documentation

## Overview

This authentication system implements industry-standard security practices for the EduPractice application:

- **No Token Exposure**: Authentication tokens are never transmitted via URLs or exposed to frontend code
- **Rate Limiting**: Login attempts are rate-limited to prevent brute force attacks
- **Email Verification**: New accounts require email verification before use
- **Secure Session Management**: Supabase handles session persistence with automatic token refresh
- **Password Strength Requirements**: Enforced on signup and password reset
- **Password Recovery**: Secure email-based password reset flow

## Architecture

### Components

#### 1. **AuthService** (`src/services/authService.js`)
Core authentication logic with no UI coupling.

**Key Functions:**
- `signInWithEmail(email, password)` - Sign in with rate limiting
- `signUpWithEmail(email, password, userData)` - Register new account
- `verifyOtp(email, token, type)` - Verify email via OTP
- `requestPasswordReset(email)` - Initiate password recovery
- `updatePasswordWithToken(password)` - Complete password reset
- `validatePasswordStrength(password)` - Validate password requirements
- `formatAuthError(error)` - User-friendly error messages

**Rate Limiting:**
- Max 5 login attempts per email
- 15-minute window per email
- Stored in localStorage (client-side enforcement)
- Backend validation recommended for production

#### 2. **AuthContext** (`src/contexts/AuthContext.jsx`)
Global authentication state management using React Context.

**Provides:**
- `user` - Current authenticated user object
- `session` - Supabase session data
- `isAuthenticated` - Boolean indicating auth state
- `isLoading` - Loading state during auth check
- `error` - Last authentication error
- Auth methods: `signIn()`, `signUp()`, `verifyOtp()`, `requestPasswordReset()`, `updatePassword()`, `logOut()`

**Usage:**
```jsx
const auth = useAuth();

// Check if authenticated
if (auth.isAuthenticated) {
  // Show protected content
}

// Sign in
const result = await auth.signIn(email, password);
if (result.success) {
  navigate('/dashboard');
}
```

#### 3. **UserContext** (`src/contexts/UserContext.jsx`)
Manages user profile data synchronized with Supabase.

**Note:** Requires a `profiles` table in Supabase:
```sql
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text UNIQUE,
  first_name text,
  last_name text,
  school_name text,
  exam_level text,
  avatar_url text,
  daily_goal integer DEFAULT 50,
  notifications boolean DEFAULT true,
  two_factor boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

**Provides:**
- `user` - User profile data from Supabase
- `isLoading` - Loading state
- `updateUser(updates)` - Update and sync profile
- `updateStats(updates)` - Update statistics
- `getFirstName()` - Get first name for greetings
- `getInitials()` - Get initials for avatar

#### 4. **ProtectedRoute** (`src/auth/ProtectedRoute.jsx`)
Route guard that ensures only authenticated users can access protected pages.

**Features:**
- Checks Supabase session status
- Shows loading animation during auth verification
- Redirects to `/login` if not authenticated
- No URL token handling (secure)

## Security Features

### 1. No URL Tokens
**Before (Insecure):**
```
https://app.com/dashboard?token=eyJhbGc...
```
**After (Secure):**
- Session stored in Supabase's secure storage
- Tokens managed automatically
- No sensitive data in URLs

### 2. Rate Limiting
```javascript
// Client-side: 5 attempts per email in 15 minutes
const rateLimit = getRateLimitState(email);
if (rateLimit.attempts >= MAX_LOGIN_ATTEMPTS) {
  // Return error with reset time
}
```

**Production Recommendation:**
Implement server-side rate limiting using:
- Redis for distributed rate limiting
- IP-based + email-based limits
- Progressive delays (exponential backoff)

### 3. Email Verification
New accounts require email verification:
1. User signs up with email/password
2. Verification code sent to email
3. User enters 6-digit code
4. Account activated after verification

### 4. Password Requirements
Enforced password strength:
- ✓ Minimum 8 characters
- ✓ Uppercase letter (A-Z)
- ✓ Lowercase letter (a-z)
- ✓ Number or special character (!@#$%^&*)

### 5. Secure Password Reset
1. User requests password reset
2. Unique token sent to registered email
3. User clicks link with token
4. User enters new password (strength validated)
5. Session updated with new password

## Usage Examples

### Setup (in main.tsx or App.jsx)

```jsx
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </AuthProvider>
  );
}
```

### Login Example
```jsx
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function LoginForm() {
  const auth = useAuth();
  const navigate = useNavigate();
  
  const handleLogin = async (email, password) => {
    const result = await auth.signIn(email, password);
    
    if (result.success) {
      navigate('/dashboard'); // Session auto-managed by Supabase
    } else {
      alert(result.error); // User-friendly error message
    }
  };
}
```

### Protected Component Example
```jsx
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';

export function Dashboard() {
  const auth = useAuth();
  const user = useUser();
  
  if (!auth.isAuthenticated) {
    return <div>Not authenticated</div>;
  }
  
  return <div>Welcome, {user.getFirstName()}!</div>;
}
```

### Logout Example
```jsx
const handleLogout = async () => {
  await auth.logOut();
  navigate('/login');
};
```

## Environment Variables

Required Supabase configuration in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:**
- `VITE_SUPABASE_ANON_KEY` is safe for frontend (it's public)
- Never expose `VITE_SUPABASE_SERVICE_ROLE_KEY` to frontend
- Service role key should only exist on backend server

## Supabase Configuration

### Enable Email Authentication
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Email" provider
3. Set email templates for:
   - Confirmation email
   - Password reset email
   - Magic link email (optional)

### Create Profiles Table
```sql
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  school_name text,
  exam_level text,
  avatar_url text,
  daily_goal integer DEFAULT 50,
  notifications boolean DEFAULT true,
  two_factor boolean DEFAULT false,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow inserting own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Row-Level Security (RLS)
Ensure RLS is enabled on profiles table to prevent unauthorized access:
- Users can only access their own profile
- Admin functions use service role key (backend only)

## Production Recommendations

### 1. Backend Authentication
Consider implementing a backend API for:
- Server-side rate limiting
- Token validation
- Additional security checks
- Audit logging

### 2. HTTPS Only
- Always use HTTPS in production
- Set secure cookie flags
- Enable HSTS headers

### 3. Monitoring & Alerts
- Log authentication events
- Alert on suspicious patterns
- Monitor rate limit violations
- Track failed login attempts

### 4. OAuth Integration
For social login (Google, GitHub, etc.):
1. Implement OAuth endpoints on backend
2. Never expose OAuth credentials to frontend
3. Validate tokens on server
4. Store in Supabase sessions

### 5. Two-Factor Authentication
1. Implement TOTP (Time-based One-Time Password)
2. Supabase supports MFA natively
3. Store backup codes securely

### 6. Session Security
```javascript
// Automatic token refresh (already configured)
autoRefreshToken: true

// Left off: this app uses password and OTP email flows only, so there is no
// OAuth callback fragment to detect. Enabling it would also let a crafted
// `#access_token=...` link in on sign-in.
detectSessionInUrl: false

// Persist session (secure storage)
persistSession: true
```

### 7. Session Lifetime (7 days)
A signed-in session lasts **7 days**, measured from sign-in, after which the
student is signed out and asked to sign in again. It is an absolute window, not
an idle timeout: activity does not extend it.

This is enforced in `client-ui/src/lib/sessionPolicy.js`, not in Supabase.

- The start instant is kept in `localStorage` under
  `edupractice_session_start`, so closing the tab or restarting the browser does
  not end the session.
- On load, a session with no marker is **adopted** with a full 7-day window, so
  students already signed in when this shipped are not signed out by a policy
  that did not exist when their session began.
- An already-expired session is ended *before* any protected route renders, so an
  expired session is never briefly usable.
- Timers are throttled hard in a backgrounded tab and a sleeping laptop, so the
  deadline is re-checked on `focus` and `visibilitychange` as well as on a timer.
- Why the session ended is stored in `sessionStorage` and read once by the login
  page, which is what lets it say *"you were signed out after 7 days"* instead of
  showing an unexplained login form.

**The client policy is a cap, not the source of truth.** Supabase's own session
and refresh-token settings are what actually limit a session; if they are
configured to expire *before* 7 days, students are signed out earlier. Those
settings live in the Supabase dashboard, not in this repository, so they cannot
be changed from code here.

### 8. Offline Sessions

A student with no network cannot refresh an access token, and Supabase ends the
session locally even though it is still valid server-side. Signing them out at
that point discards a working session for the crime of being on a train, so
`AuthContext` does this instead:

- On a `SIGNED_OUT` event with no network, the session is **held open** and
  `isOffline` is set. The student keeps their session and all local work.
- This is a deferral, not a bypass. When connectivity returns, the app calls
  `getSession()` and asks the server whether the session is genuinely still
  valid. If it is not, the student is signed out then — they simply were not told
  about it while they had no way to act on it.
- A real expiry (the 7-day window elapsing) is unaffected: that is enforced
  locally and does not depend on the network.

`navigator.onLine` only reports whether a network interface exists, not whether
the internet is reachable, so it is treated as a hint. A "true" that lies simply
causes a failed request, which the sync queue retries.

## Error Handling

Error messages are user-friendly:
```javascript
{
  'Invalid login credentials': 'Email or password is incorrect',
  'Email not confirmed': 'Please verify your email before logging in',
  'User already registered': 'This email is already registered',
  'Weak password': 'Password must be at least 8 characters...'
}
```

## Testing

### Test Rate Limiting
```javascript
// Try 5+ logins in 15 minutes with same email
for (let i = 0; i < 6; i++) {
  await auth.signIn('test@example.com', 'wrongpassword');
}
// Should get: "Too many login attempts. Please try again in X minutes."
```

### Test Email Verification
1. Sign up with new email
2. Check email inbox for verification code
3. Enter code in verification form
4. Account should be activated

### Test Password Reset
1. Go to `/login`
2. Click "Forgot Password"
3. Enter email address
4. Check email for reset link
5. Click link → `/reset-password?token=...&type=recovery`
6. Enter new password
7. Password should be updated

## Migration from Old Auth System

If migrating from token-based auth:

1. **Remove URL token handling:**
   - Delete `redirectWithToken()` function
   - Remove `?token=` parameter parsing
   - Stop storing tokens in sessionStorage

2. **Clear old data:**
   ```javascript
   // Clear old auth data
   sessionStorage.removeItem('auth_token');
   sessionStorage.removeItem('login_timestamp');
   localStorage.removeItem('eduPractice_user');
   ```

3. **Update routes:**
   - Add `<AuthProvider>` at root
   - Wrap protected routes with `<ProtectedRoute>`
   - Use `useAuth()` in components

4. **Test thoroughly:**
   - Login/signup flows
   - Protected routes
   - Logout behavior
   - Session persistence

## Troubleshooting

### Session Not Persisting
- Check browser localStorage is enabled
- Verify Supabase `persistSession: true`
- Check browser privacy/incognito mode

### Signed Out After 7 Days
- Working as intended if `edupractice_session_start` in localStorage is 7 days
  old — the window is absolute and does not extend with activity
- Signed out *earlier* than 7 days? Check the Supabase session and refresh-token
  settings in the dashboard; the client policy can only shorten a session, never
  lengthen it
- localStorage blocked (private browsing, enterprise policy) means the 7-day
  window cannot be tracked; the app degrades to Supabase's own session lifetime
  rather than failing
- A stale *"you were signed out after 7 days"* message on the login page means
  `edupractice_signout_reason` survived in sessionStorage; it is cleared on read

### Rate Limit Not Working
- Verify localStorage is enabled
- Check browser console for errors
- Ensure email format is normalized

### Email Verification Not Sending
- Check Supabase email templates configured
- Verify email provider settings
- Check spam/junk folder

### Password Reset Not Working
- Ensure reset link includes `type=recovery`
- Check email link expiration (usually 1 hour)
- Verify `updatePasswordWithToken()` in auth service

## API Reference

See `src/services/authService.js` for complete function signatures and detailed documentation.

## Support & Questions

For issues with:
- **Supabase Auth:** Check [Supabase Documentation](https://supabase.com/docs/guides/auth)
- **Rate Limiting:** Review rate limit logic in `authService.js`
- **React Context:** See [React Context API Docs](https://react.dev/reference/react/useContext)
