import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCapIcon, MailIcon, LockIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const auth = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Why the student landed back here. A week-long session expiring mid-lesson is
  // a different experience from having been bounced, and the page should say so
  // rather than presenting an unexplained login form.
  const [notice, setNotice] = useState(null)

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/dashboard')
    }
  }, [auth.isAuthenticated, navigate])

  useEffect(() => {
    const reason = auth.takeSignOutReason()
    if (reason === 'expired') {
      setNotice(`You were signed out after ${auth.sessionDays} days. Sign in again to pick up where you left off.`)
    }
  }, [])

  // Clear error as the user starts typing
  useEffect(() => {
    if (error) setError('')
  }, [email, password])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)
    try {
      const result = await auth.signIn(email, password)

      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error || 'Failed to sign in. Please try again.')
      }
    } catch (err) {
      setError(err?.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (auth.isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0B1120] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
          <p className="text-gray-400">Loading authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#0B1120] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center">
            <GraduationCapIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-900" />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white">EduPractice</span>
        </Link>

        {/* Login Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
            Welcome Back
          </h1>
          <p className="text-sm sm:text-base text-gray-400 text-center mb-8 sm:mb-10">
            Sign in to continue your learning journey
          </p>

          {notice && (
            <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm text-center flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 001.5.87l2.5-3A1 1 0 0011 6.5h-1V6z" clipRule="evenodd" />
              </svg>
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <Link
                  to="/reset-password"
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#1a1f2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors text-sm"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-6 px-4">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>

          {/* Sign Up */}
          <p className="text-center text-gray-400 text-sm mt-6 sm:mt-8">
            New to EduPractice?{' '}
            <Link to="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Create account
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <Link
          to="/"
          className="block text-center text-gray-400 hover:text-white text-sm mt-5 sm:mt-6 transition-colors"
        >
          ← Back to home
        </Link>
      </motion.div>
    </div>
  )
}