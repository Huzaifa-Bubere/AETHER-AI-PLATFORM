import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Brain, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/auth/forgot-password', { email });
      
      if (response.success) {
        setSent(true);
        toast.success('Password reset link sent!');
      } else {
        setError(response.error || 'Failed to send reset link');
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      setError(error.message || 'Failed to send reset link');
      toast.error('Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setSent(false);
    setEmail('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gray-50">
      <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
      
      <Card className="w-full max-w-md relative z-10 p-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 bg-primary rounded-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-semibold text-foreground">Smart Interview AI</span>
        </div>

        {!sent ? (
          <>
            <h1 className="text-3xl font-bold text-center mb-2">Reset Password</h1>
            <p className="text-center text-muted-foreground mb-8">
              Enter your email and we'll send you a reset link
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
            <p className="text-muted-foreground mb-6">
              We've sent a password reset link to <span className="text-primary font-medium">{email}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Didn't receive the email? Check your spam folder or{' '}
              <button onClick={handleResend} className="text-primary hover:underline font-medium">
                try again
              </button>
            </p>
          </div>
        )}

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium mt-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </Card>
    </div>
  );
}
