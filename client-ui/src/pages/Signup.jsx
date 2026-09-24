import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCapIcon, MailIcon, LockIcon, CheckIcon, CircleAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as authService from '../services/authService';

const initialFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  schoolName: '',
  examLevel: '',
};

export default function Signup() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [formData, setFormData] = useState(initialFormData);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/dashboard');
    }
  }, [auth.isAuthenticated, navigate]);

  // Recompute password strength live
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(authService.validatePasswordStrength(formData.password));
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!passwordStrength?.isValid) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number or special character.');
      return;
    }

    setLoading(true);
    try {
      const result = await auth.signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        schoolName: formData.schoolName,
        examLevel: formData.examLevel,
      });

      if (result.success && result.needsVerification) {
        setVerifying(true);
        setVerificationMessage('');
        setVerificationError('');
      } else if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setVerificationError('');
    setVerificationMessage('');
    setLoading(true);
    try {
      const result = await auth.resendVerificationEmail(formData.email);
      if (result.success) {
        setVerificationMessage('Verification email resent. Check your inbox.');
      } else {
        setVerificationError(result.error || 'Failed to resend verification email.');
      }
    } catch (err) {
      setVerificationError(err?.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0B1120] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
          <p className="text-gray-400">Loading authentication...</p>
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
        {/* Header */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center">
            <GraduationCapIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-900" />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white">EduPractice</span>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {verifying ? 'Verify your email' : 'Create Account'}
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-2">
            {verifying
              ? 'Almost there — just confirm your email address'
              : 'Join thousands of students preparing for exams'}
          </p>
        </div>

        {verifying ? (
          <>
            {verificationError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <CircleAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}
            {verificationMessage && (
              <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                {verificationMessage}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-center text-gray-400 text-sm">
                We sent a verification link to <span className="text-gray-200">{formData.email}</span>.
                Open your email and click the link to activate your account.
              </p>

              <button
                type="button"
                onClick={handleResendVerification}
                className="w-full py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Resend verification email'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerifying(false);
                  setVerificationError('');
                  setVerificationMessage('');
                }}
                className="w-full text-gray-400 text-sm hover:text-gray-300 transition-colors"
                disabled={loading}
              >
                ← Back to signup form
              </button>

              <p className="text-center text-gray-400 text-sm">
                Already verified?{' '}
                <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center flex items-center justify-center gap-2">
                <CircleAlert className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full bg-[#1a1f2e] border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full bg-[#1a1f2e] border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="password"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Password Strength Indicator */}
                {formData.password && passwordStrength && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded-full transition-colors ${
                            i < passwordStrength.score
                              ? passwordStrength.score <= 1
                                ? 'bg-red-500'
                                : passwordStrength.score <= 2
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div className={passwordStrength.length ? 'text-green-400' : 'text-gray-400'}>
                        ✓ At least 8 characters
                      </div>
                      <div className={passwordStrength.uppercase ? 'text-green-400' : 'text-gray-400'}>
                        ✓ Uppercase letter
                      </div>
                      <div className={passwordStrength.lowercase ? 'text-green-400' : 'text-gray-400'}>
                        ✓ Lowercase letter
                      </div>
                      <div className={passwordStrength.numbers || passwordStrength.specialChars ? 'text-green-400' : 'text-gray-400'}>
                        ✓ Number or special character
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    required
                    disabled={loading}
                  />
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <CheckIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>

              {/* School Info (Optional) */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    School (Optional)
                  </label>
                  <input
                    type="text"
                    name="schoolName"
                    placeholder="Your school"
                    value={formData.schoolName}
                    onChange={handleInputChange}
                    className="w-full bg-[#1a1f2e] border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Exam Level (Optional)
                  </label>
                  <select
                    name="examLevel"
                    value={formData.examLevel}
                    onChange={handleInputChange}
                    className="w-full bg-[#1a1f2e] border border-gray-700 p-3 rounded-lg text-white focus:outline-none focus:border-amber-400 transition-colors text-sm"
                    disabled={loading}
                  >
                    <option value="">Select level</option>
                    <option value="A-Level">A-Level</option>
                    <option value="UACE">UACE</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            {/* Login Link */}
            <p className="text-center text-gray-400 text-sm mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>

            <p className="text-center text-gray-500 text-xs mt-4 px-4">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}