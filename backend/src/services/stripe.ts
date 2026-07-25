import Stripe from 'stripe';
import logger from '../utils/logger';
import User from '../models/User';

class StripeService {
  private stripe: Stripe | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      logger.warn('Stripe not configured - payment features will not be available');
      logger.warn('Set STRIPE_SECRET_KEY environment variable to enable payments');
      this.isConfigured = false;
      return;
    }

    try {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2026-01-28.clover' as any,
        typescript: true,
      });
      this.isConfigured = true;
      logger.info('Stripe service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Stripe service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(data: {
    email: string;
    name: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer | null> {
    if (!this.isConfigured || !this.stripe) {
      logger.warn('Stripe not configured - cannot create customer');
      return null;
    }

    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: data.metadata || {},
      });

      logger.info(`Stripe customer created: ${customer.id} for ${data.email}`);
      return customer;
    } catch (error: any) {
      logger.error('Failed to create Stripe customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(data: {
    customerId: string;
    priceId?: string;
    plan: 'pro' | 'enterprise';
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session | null> {
    if (!this.isConfigured || !this.stripe) {
      logger.warn('Stripe not configured - cannot create checkout session');
      return null;
    }

    try {
      // Define pricing in INR (Indian Rupees)
      const pricing = {
        pro: {
          amount: 2499, // ₹2,499 per month (approximately $29)
          currency: 'inr',
          name: 'Pro Plan',
          description: 'Unlimited interviews with advanced AI feedback',
        },
        enterprise: {
          amount: 8499, // ₹8,499 per month (approximately $99)
          currency: 'inr',
          name: 'Enterprise Plan',
          description: 'Everything in Pro plus team management and API access',
        },
      };

      const planPricing = pricing[data.plan];

      // Create checkout session with dynamic pricing
      const session = await this.stripe.checkout.sessions.create({
        customer: data.customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: planPricing.currency,
              product_data: {
                name: planPricing.name,
                description: planPricing.description,
              },
              unit_amount: planPricing.amount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: data.metadata || {},
      });

      logger.info(`Checkout session created: ${session.id}`);
      return session;
    } catch (error: any) {
      logger.error('Failed to create checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(data: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session | null> {
    if (!this.isConfigured || !this.stripe) {
      logger.warn('Stripe not configured - cannot create billing portal session');
      return null;
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: data.customerId,
        return_url: data.returnUrl,
      });

      logger.info(`Billing portal session created for customer: ${data.customerId}`);
      return session;
    } catch (error: any) {
      logger.error('Failed to create billing portal session:', error);
      throw new Error(`Failed to create billing portal session: ${error.message}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    if (!this.isConfigured || !this.stripe) {
      return null;
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error: any) {
      logger.error('Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    if (!this.isConfigured || !this.stripe) {
      return null;
    }

    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      logger.info(`Subscription cancelled: ${subscriptionId}`);
      return subscription;
    } catch (error: any) {
      logger.error('Failed to cancel subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<{ success: boolean; event?: Stripe.Event; error?: string }> {
    if (!this.isConfigured || !this.stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return { success: false, error: 'Webhook secret not configured' };
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      logger.info(`Webhook received: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      return { success: true, event };
    } catch (error: any) {
      logger.error('Webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });

      if (user) {
        user.subscription.stripeSubscriptionId = subscription.id;
        user.subscription.status = 'active';
        user.subscription.plan = this.getPlanFromPriceId(subscription.items.data[0].price.id);
        user.subscription.expiresAt = new Date((subscription as any).current_period_end * 1000);
        await user.save();

        logger.info(`Subscription created for user: ${user.email}`);
      }
    } catch (error) {
      logger.error('Error handling subscription created:', error);
    }
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id,
      });

      if (user) {
        user.subscription.status = subscription.status === 'active' ? 'active' : 'inactive';
        user.subscription.plan = this.getPlanFromPriceId(subscription.items.data[0].price.id);
        user.subscription.expiresAt = new Date((subscription as any).current_period_end * 1000);
        await user.save();

        logger.info(`Subscription updated for user: ${user.email}`);
      }
    } catch (error) {
      logger.error('Error handling subscription updated:', error);
    }
  }

  /**
   * Handle subscription deleted event
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id,
      });

      if (user) {
        user.subscription.status = 'cancelled';
        user.subscription.plan = 'free';
        await user.save();

        logger.info(`Subscription cancelled for user: ${user.email}`);
      }
    } catch (error) {
      logger.error('Error handling subscription deleted:', error);
    }
  }

  /**
   * Handle payment succeeded event
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      const customerId = invoice.customer as string;
      const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });

      if (user) {
        logger.info(`Payment succeeded for user: ${user.email}, amount: ${invoice.amount_paid / 100}`);
        // You can send a receipt email here
      }
    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const customerId = invoice.customer as string;
      const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });

      if (user) {
        logger.warn(`Payment failed for user: ${user.email}`);
        // You can send a payment failed email here
      }
    } catch (error) {
      logger.error('Error handling payment failed:', error);
    }
  }

  /**
   * Get plan name from price ID
   */
  private getPlanFromPriceId(priceId: string): 'free' | 'pro' | 'enterprise' {
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
    const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;

    if (priceId === proPriceId) return 'pro';
    if (priceId === enterprisePriceId) return 'enterprise';
    return 'free';
  }

  /**
   * Check if Stripe is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get Stripe instance (for advanced usage)
   */
  getStripe(): Stripe | null {
    return this.stripe;
  }
}

export const stripeService = new StripeService();
export default stripeService;
