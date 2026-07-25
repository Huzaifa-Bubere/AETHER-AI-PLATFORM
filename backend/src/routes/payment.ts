import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import stripeService from '../services/stripe';
import User from '../models/User';
import Payment from '../models/Payment';
import emailService from '../services/email';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Create Stripe checkout session
 * POST /api/payment/create-checkout-session
 */
router.post('/create-checkout-session', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  const { plan } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  if (!plan || !['pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({
      success: false,
      error: 'Valid plan (pro or enterprise) is required',
    });
  }

  if (!stripeService.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'Payment service not configured',
      message: 'Stripe is not configured. Please contact support.',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Create or get Stripe customer
    let customerId = user.subscription.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripeService.createCustomer({
        email: user.email,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        metadata: {
          userId: user._id.toString(),
        },
      });

      if (!customer) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create customer',
        });
      }

      customerId = customer.id;
      user.subscription.stripeCustomerId = customerId;
      await user.save();
    }

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      customerId,
      plan: plan as 'pro' | 'enterprise',
      successUrl: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/subscription`,
      metadata: {
        userId: user._id.toString(),
        plan,
      },
    });

    if (!session) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create checkout session',
      });
    }

    logger.info(`Checkout session created for user: ${user.email}, plan: ${plan}`);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error: any) {
    logger.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
}));

/**
 * Create billing portal session
 * POST /api/payment/create-portal-session
 */
router.post('/create-portal-session', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  if (!stripeService.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'Payment service not configured',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const customerId = user.subscription.stripeCustomerId;
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription',
      });
    }

    const session = await stripeService.createBillingPortalSession({
      customerId,
      returnUrl: `${process.env.FRONTEND_URL}/profile`,
    });

    if (!session) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create portal session',
      });
    }

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error: any) {
    logger.error('Create portal session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session',
      message: error.message,
    });
  }
}));

/**
 * Get subscription status
 * GET /api/payment/subscription
 */
router.get('/subscription', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const subscription = user.subscription;
    let stripeSubscription = null;

    if (subscription.stripeSubscriptionId && stripeService.isReady()) {
      stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId);
    }

    res.json({
      success: true,
      data: {
        plan: subscription.plan,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeDetails: stripeSubscription ? {
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        } : null,
      },
    });
  } catch (error: any) {
    logger.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription',
      message: error.message,
    });
  }
}));

/**
 * Cancel subscription
 * POST /api/payment/cancel-subscription
 */
router.post('/cancel-subscription', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  if (!stripeService.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'Payment service not configured',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const subscriptionId = user.subscription.stripeSubscriptionId;
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription',
      });
    }

    const canceledSubscription = await stripeService.cancelSubscription(subscriptionId);
    if (!canceledSubscription) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription',
      });
    }

    logger.info(`Subscription cancelled for user: ${user.email}`);

    // Type assertion for Stripe subscription with current_period_end
    const subscription = canceledSubscription as any;
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        canceledAt: new Date(),
        endsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      message: error.message,
    });
  }
}));

/**
 * Stripe webhook handler
 * POST /api/payment/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    });
  }

  if (!stripeService.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'Payment service not configured',
    });
  }

  try {
    const result = await stripeService.handleWebhook(req.body, signature);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      received: true,
    });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error',
      message: error.message,
    });
  }
}));

/**
 * Verify payment session and update subscription
 * GET /api/payment/verify-session/:sessionId
 */
router.get('/verify-session/:sessionId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  const { sessionId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  if (!stripeService.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'Payment service not configured',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Get session from Stripe
    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Stripe not available',
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items'],
    });

    if (session.payment_status === 'paid' && session.customer) {
      // Update user subscription
      const plan = session.metadata?.plan as 'pro' | 'enterprise' | undefined;
      
      if (plan) {
        user.subscription.plan = plan;
        user.subscription.status = 'active';
        user.subscription.stripeCustomerId = session.customer as string;
        
        // Get subscription ID from session
        let expiryDate = new Date();
        if (session.subscription) {
          user.subscription.stripeSubscriptionId = session.subscription as string;
          
          try {
            // Get subscription details for expiry date
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            if ((subscription as any).current_period_end) {
              expiryDate = new Date((subscription as any).current_period_end * 1000);
              user.subscription.expiresAt = expiryDate;
            }
          } catch (subError) {
            logger.warn('Could not retrieve subscription details:', subError);
            // Set default expiry to 1 month from now
            expiryDate.setMonth(expiryDate.getMonth() + 1);
            user.subscription.expiresAt = expiryDate;
          }
        } else {
          // No subscription ID (one-time payment), set default expiry to 1 month
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          user.subscription.expiresAt = expiryDate;
        }
        
        await user.save();

        // Create payment record
        const paymentIntent = session.payment_intent as any;
        const amount = session.amount_total || 0;
        
        const payment = await Payment.create({
          userId: user._id,
          stripeSessionId: sessionId,
          stripePaymentIntentId: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string || null,
          amount,
          currency: session.currency?.toUpperCase() || 'INR',
          plan,
          status: 'completed',
          paymentMethod: paymentIntent?.payment_method_types?.[0] || 'card',
          receiptUrl: paymentIntent?.charges?.data?.[0]?.receipt_url || null,
          metadata: {
            sessionId,
            customerEmail: session.customer_details?.email,
          },
        });

        logger.info(`Payment record created for user: ${user.email}, amount: ${amount}, plan: ${plan}`);

        // Send payment receipt email
        try {
          await emailService.sendPaymentReceiptEmail(
            user.email,
            user.profile.firstName,
            {
              transactionId: payment._id.toString(),
              plan,
              amount,
              currency: payment.currency,
              date: payment.createdAt,
              paymentMethod: payment.paymentMethod,
              receiptUrl: payment.receiptUrl || undefined,
            }
          );
          logger.info(`Payment receipt email sent to: ${user.email}`);
        } catch (emailError) {
          logger.error('Failed to send payment receipt email:', emailError);
          // Don't fail the request if email fails
        }

        logger.info(`Subscription activated for user: ${user.email}, plan: ${plan}`);
      }
    }

    res.json({
      success: true,
      data: {
        paymentStatus: session.payment_status,
        subscription: user.subscription,
      },
    });
  } catch (error: any) {
    logger.error('Verify session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session',
      message: error.message,
    });
  }
}));

/**
 * Get pricing plans
 * GET /api/payment/plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      currency: 'INR',
      interval: 'month',
      features: [
        '5 interviews per month',
        'Basic feedback',
        'Resume analysis',
        'Email support',
      ],
      priceId: null,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 2499,
      currency: 'INR',
      interval: 'month',
      features: [
        'Unlimited interviews',
        'Advanced AI feedback',
        'Video analysis',
        'Code execution',
        'Priority support',
        'Interview history',
      ],
      priceId: null, // Using dynamic pricing
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 8499,
      currency: 'INR',
      interval: 'month',
      features: [
        'Everything in Pro',
        'Custom interview templates',
        'Team management',
        'API access',
        'Dedicated support',
        'Custom integrations',
      ],
      priceId: null, // Using dynamic pricing
    },
  ];

  res.json({
    success: true,
    data: plans,
  });
}));

/**
 * Get payment history
 * GET /api/payment/history
 */
router.get('/history', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();

    res.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history',
      message: error.message,
    });
  }
}));

/**
 * Payment health check
 * GET /api/payment/health
 */
router.get('/health', asyncHandler(async (req, res) => {
  const isReady = stripeService.isReady();

  res.json({
    success: true,
    status: isReady ? 'operational' : 'not_configured',
    message: isReady ? 'Payment service is operational' : 'Stripe not configured',
    timestamp: new Date().toISOString(),
  });
}));

export default router;
