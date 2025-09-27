require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const StripeService = require('./stripe-config');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase environment variables not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStripePlans() {
  try {
    console.log('🚀 Setting up Stripe plans...');

    if (!StripeService.isConfigured) {
      console.error('❌ Stripe not configured. Please set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY');
      process.exit(1);
    }

    // Create Stripe plans
    const plans = await StripeService.createPlans();
    console.log('✅ Stripe plans created:', plans);

    // Create a table to store Stripe price IDs for easy reference
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.stripe_prices (
          id SERIAL PRIMARY KEY,
          plan_type TEXT NOT NULL,
          price_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          credits INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createTableError) {
      console.log('Table might already exist, continuing...');
    }

    // Get the price IDs from Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const prices = await stripe.prices.list({ limit: 100 });

    // Insert price records
    for (const price of prices.data) {
      if (price.metadata.plan_type) {
        const { error: insertError } = await supabase
          .from('stripe_prices')
          .upsert({
            plan_type: price.metadata.plan_type,
            price_id: price.id,
            amount: price.unit_amount,
            credits: parseInt(price.metadata.credits)
          }, {
            onConflict: 'plan_type'
          });

        if (insertError) {
          console.error('Error inserting price:', insertError);
        } else {
          console.log(`✅ Price record created for ${price.metadata.plan_type}: ${price.id}`);
        }
      }
    }

    console.log('🎉 Stripe plans setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up Stripe webhook endpoint: https://your-domain.com/api/stripe/webhook');
    console.log('2. Configure webhook events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed');
    console.log('3. Update your server to use server-with-stripe.js');
    console.log('4. Test the subscription flow');

  } catch (error) {
    console.error('❌ Error setting up Stripe plans:', error);
    process.exit(1);
  }
}

// Run the setup
setupStripePlans();
