import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [message, setMessage] = useState('Verifying your email…');
  useEffect(() => {
    let active = true;
    if (!token) { setMessage('The verification link is missing its token.'); return; }
    apiService.get('/auth/verify-email', { token }).then((result) => {
      if (active) setMessage(result.success ? 'Your email is verified.' : result.error || 'This link is invalid or expired.');
    });
    return () => { active = false; };
  }, [token]);
  return <main className="min-h-screen pt-32 px-6 text-center">
    <h1 className="text-2xl font-semibold">Email verification</h1>
    <p role="status" className="my-6">{message}</p>
    <Link to="/login" className="text-primary underline">Continue to sign in</Link>
  </main>;
}
