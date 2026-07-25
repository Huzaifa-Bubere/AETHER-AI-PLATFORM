import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, Crown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      // First verify the payment session
      if (sessionId) {
        await apiService.get(`/payment/verify-session/${sessionId}`);
      }
      
      // Then fetch updated subscription details
      const response = await apiService.get('/payment/subscription');
      
      if (response.success) {
        setSubscription(response.data);
        toast.success('Payment successful! Your subscription is now active.');
      }
    } catch (error) {
      console.error('Failed to verify payment:', error);
      toast.error('Payment verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Payment Successful!
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Thank you for subscribing to Smart Interview AI
          </p>

          {/* Subscription Details */}
          {subscription && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Crown className="w-6 h-6 text-indigo-600" />
                <h2 className="text-2xl font-bold text-indigo-900">
                  {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
                </h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </span>
                </div>
                {subscription.expiresAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next Billing Date:</span>
                    <span className="font-medium">
                      {new Date(subscription.expiresAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="text-left mb-8">
            <h3 className="text-lg font-semibold mb-4">What's Next?</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  Your subscription is now active and ready to use
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  Access unlimited AI-powered interview practice sessions
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  Get detailed feedback and analytics on your performance
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  A confirmation email has been sent to your inbox
                </span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="default"
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/subscription')}
            >
              View Subscription Details
            </Button>
          </div>
        </Card>

        {/* Support */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:support@smartinterviewai.com" className="text-primary hover:underline">
              support@smartinterviewai.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
