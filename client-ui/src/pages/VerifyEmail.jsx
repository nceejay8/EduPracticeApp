import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CircleAlert, GraduationCapIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [status, setStatus] = useState('confirming');
  const [confirmationError, setConfirmationError] = useState('');

  // Consume the confirmation link token (sent by Supabase as ?token_hash=&type=)
  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (!tokenHash || !type) {
      if (!auth.isAuthenticated) {
        setStatus('no_op');
      }
      return;
    }

    const confirm = async () => {
      setStatus('confirming');
      const result = await auth.confirmEmail(tokenHash, type);
      if (result.success) {
        setStatus('verified');
      } else {
        setStatus('error');
        setConfirmationError(result.error || 'This verification link is invalid or has expired.');
      }
    };

    confirm();
  }, [searchParams, auth]);

  // Once verified/authenticated, count down to the dashboard
  useEffect(() => {
    if ((status === 'verified' && auth.isAuthenticated) || (status === 'no_op' && auth.isAuthenticated)) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            navigate('/dashboard', { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, auth.isAuthenticated, navigate]);

  if (auth.isLoading || status === 'confirming') {
    return (
      <div className="min-h-screen w-full bg-[#0B1120] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
          <p className="text-gray-400">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4 sm:p-6 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6 sm:p-8"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center">
            <GraduationCapIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-900" />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white">EduPractice</span>
        </Link>

        {status === 'verified' && auth.isAuthenticated ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Email Verified!</h1>
            <p className="text-gray-400 text-sm">
              Your account is all set. Redirecting to dashboard in {countdown}s...
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors mt-4"
            >
              Go to dashboard now
            </button>
          </div>
        ) : status === 'error' ? (
          <div className="text-center space-y-4">
            <CircleAlert className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
            <p className="text-red-400 text-sm">{confirmationError}</p>
            <Link
              to="/login"
              className="block w-full text-center py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors mt-4"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-amber-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-gray-400 text-sm">
              We sent you a verification link. Open it to activate your account, or go back to login.
            </p>
            <Link
              to="/login"
              className="block w-full text-center py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors mt-4"
            >
              Go to login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}