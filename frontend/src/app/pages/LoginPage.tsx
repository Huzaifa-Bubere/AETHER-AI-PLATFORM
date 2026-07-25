import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Brain, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ✅ password visibility state
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gray-50">
      <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>

      <Card className="w-full max-w-md relative z-10 p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 bg-primary rounded-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-semibold text-foreground">
            Smart Interview AI
          </span>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2">Welcome Back</h1>

        <p className="text-center text-muted-foreground mb-8">
          Sign in to continue your interview preparation
        </p>

        {/* Backend Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />

            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>

          {/* Password with show/hide */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />

            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span className="text-muted-foreground">Remember me</span>
            </label>

            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : null}
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="text-primary hover:underline font-medium"
          >
            Sign up for free
          </Link>
        </p>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            Are you an administrator?{' '}
            <Link
              to="/admin/login"
              className="text-primary hover:underline font-medium"
            >
              Admin Login
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
