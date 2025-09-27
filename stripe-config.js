// Stripe configuration and utility functions
class StripeService {
  constructor() {
    this.stripe = null;
    this.isConfigured = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (this.isConfigured) {
      this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    } else {
      console.warn('⚠️  Stripe environment variables not set. Payment features will be disabled.');
      console.warn('Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to enable payments.');
    }
  }

  // Create subscription plans
  async createPlans() {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      // Create $10/month plan for 100 credits
      const basicPlan = await this.stripe.products.create({
        name: 'Basic Plan - 100 Credits',
        description: 'Monthly subscription with 100 AI image generation credits',
        metadata: {
          credits: '100',
          type: 'subscription'
        }
      });

      await this.stripe.prices.create({
        product: basicPlan.id,
        unit_amount: 1000, // $10.00 in cents
        currency: 'usd',
        recurring: {
          interval: 'month'
        },
        metadata: {
          credits: '100',
          plan_type: 'basic'
        }
      });

      // Create $25/month plan for 300 credits
      const premiumPlan = await this.stripe.products.create({
        name: 'Premium Plan - 300 Credits',
        description: 'Monthly subscription with 300 AI image generation credits',
        metadata: {
          credits: '300',
          type: 'subscription'
        }
      });

      await this.stripe.prices.create({
        product: premiumPlan.id,
        unit_amount: 2500, // $25.00 in cents
        currency: 'usd',
        recurring: {
          interval: 'month'
        },
        metadata: {
          credits: '300',
          plan_type: 'premium'
        }
      });

      // Create $5 one-time credit refill
      const refillProduct = await this.stripe.products.create({
        name: 'Credit Refill - 35 Credits',
        description: 'One-time purchase of 35 additional AI image generation credits',
        metadata: {
          credits: '35',
          type: 'refill'
        }
      });

      await this.stripe.prices.create({
        product: refillProduct.id,
        unit_amount: 500, // $5.00 in cents
        currency: 'usd',
        metadata: {
          credits: '35',
          plan_type: 'refill'
        }
      });

      console.log('✅ Stripe plans created successfully');
      return {
        basicPlan: basicPlan.id,
        premiumPlan: premiumPlan.id,
        refillProduct: refillProduct.id
      };
    } catch (error) {
      console.error('Error creating Stripe plans:', error);
      throw error;
    }
  }

  // Create checkout session for subscription
  async createSubscriptionCheckout(customerId, priceId, successUrl, cancelUrl) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: 'subscription'
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating subscription checkout:', error);
      throw error;
    }
  }

  // Create checkout session for credit refill
  async createRefillCheckout(customerId, priceId, successUrl, cancelUrl) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: 'refill'
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating refill checkout:', error);
      throw error;
    }
  }

  // Create or get Stripe customer
  async createOrGetCustomer(email, userId) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      // Check if customer already exists
      const existingCustomers = await this.stripe.customers.list({
        email: email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: email,
        metadata: {
          user_id: userId
        }
      });

      return customer;
    } catch (error) {
      console.error('Error creating/getting customer:', error);
      throw error;
    }
  }

  // Update subscription (upgrade/downgrade)
  async updateSubscription(subscriptionId, newPriceId) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations'
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw error;
    }
  }

  // Get customer's subscriptions
  async getCustomerSubscriptions(customerId) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all'
      });

      return subscriptions.data;
    } catch (error) {
      console.error('Error getting customer subscriptions:', error);
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    if (!this.isConfigured || !this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }
}

module.exports = StripeService;
