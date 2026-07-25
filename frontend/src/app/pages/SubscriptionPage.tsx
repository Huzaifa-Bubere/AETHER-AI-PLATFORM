import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiService.get('/payment/plans');
      if (response.success) {
        setPlans(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await apiService.get('/payment/subscription');
      if (response.success) {
        setCurrentPlan(response.data.plan || 'free');
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') {
      toast.info('You are already on the free plan');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/payment/create-checkout-session', {
        plan: planId,
      });

      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error(response.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await apiService.post('/payment/create-portal-session', {});
      
      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to open billing portal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold gradient-text mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Unlock the full potential of AI-powered interview preparation
          </p>
          {currentPlan !== 'free' && (
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <Crown className="w-4 h-4" />
                Current Plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </span>
            </div>
          )}
        </div>

        
        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 items-stretch">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative p-8 flex flex-col h-full transition-all duration-300
              ${plan.id === 'pro'
                  ? 'border-2 border-primary shadow-xl'
                  : 'border border-border hover:shadow-lg'
              }`}
            >
              {/* Most Popular Badge */}
              {plan.id === 'pro' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
                  {plan.id === 'free' && <Zap className="w-8 h-8 text-primary" />}
                  {plan.id === 'pro' && <Crown className="w-8 h-8 text-primary" />}
                  {plan.id === 'enterprise' && <Shield className="w-8 h-8 text-primary" />}
                </div>

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-primary">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{plan.interval}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8 text-sm flex-1">
                {plan.features.map((feature: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Button (Always Bottom) */}
              <div className="mt-auto">
                <Button
                  variant={plan.id === 'pro' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => {
                    if (plan.id === currentPlan) {
                      handleManageSubscription();
                    } else if (plan.id === 'free') {
                      toast.info('You are already on the free plan');
                    } else {
                      handleUpgrade(plan.id);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : plan.id === currentPlan ? (
                    'Manage Subscription'
                  ) : plan.id === 'free' ? (
                    'Current Plan'
                  ) : (
                    <>
                      Upgrade Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>


        {/* Current Subscription Details */}
        {currentPlan !== 'free' && (
          <Card className="p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Subscription Details</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                <p className="text-lg font-semibold">
                  {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Manage Billing
              </Button>
            </div>
          </Card>
        )}

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and digital wallets through Stripe.',
              },
              {
                q: 'Is there a free trial?',
                a: 'The free plan is available forever with limited features. You can upgrade anytime to unlock all features.',
              },
              {
                q: 'Can I upgrade or downgrade my plan?',
                a: 'Yes, you can change your plan at any time. Changes take effect immediately.',
              },
            ].map((faq, index) => (
              <Card key={index} className="p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
