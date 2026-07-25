import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Brain, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    
    if (pwd.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

    // Validate passwords
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setValidationErrors(pwdErrors);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/auth/reset-password', {
        token,
        password,
      });

      if (response.success) {
        setSuccess(true);
        toast.success('Password reset successful!');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(response.error || 'Failed to reset password');
        toast.error('Failed to reset password');
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.message || 'Failed to reset password');
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): { strength: string; color: string; width: string } => {
    if (!pwd) return { strength: '', color: '', width: '0%' };
    
    const errors = validatePassword(pwd);
    const score = 5 - errors.length;
    
    if (score === 5) return { strength: 'Strong', color: 'bg-green-500', width: '100%' };
    if (score >= 3) return { strength: 'Medium', color: 'bg-yellow-500', width: '66%' };
    return { strength: 'Weak', color: 'bg-red-500', width: '33%' };
  };

  const passwordStrength = getPasswordStrength(password);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gray-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
        
        <Card className="w-full max-w-md relative z-10 text-center p-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Password Reset Successful!</h1>
          <p className="text-muted-foreground mb-6">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to login page...
          </p>
        </Card>
      </div>
    );
  }

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

        <h1 className="text-3xl font-bold text-center mb-2">Set New Password</h1>
        <p className="text-center text-muted-foreground mb-8">
          Enter your new password below
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-800 mb-2">Password requirements:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {validationErrors.map((err, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                  setValidationErrors([]);
                }}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
            
            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Password strength:</span>
                  <span className={`font-medium ${
                    passwordStrength.strength === 'Strong' ? 'text-green-600' :
                    passwordStrength.strength === 'Medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.strength}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${passwordStrength.color} h-2 rounded-full transition-all duration-300`}
                    style={{ width: passwordStrength.width }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              className="pl-10"
              required
              disabled={loading}
            />
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-red-600">Passwords do not match</p>
          )}

          <Button 
            type="submit" 
            variant="default" 
            className="w-full"
            disabled={loading || !token}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium mt-6">
          Back to Login
        </Link>
      </Card>
    </div>
  );
}
