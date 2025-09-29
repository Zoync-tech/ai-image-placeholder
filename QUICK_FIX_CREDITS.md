# Quick Fix for Credit Assignment Issue

## Problem
After successful Stripe subscription payments, users are not receiving their credits because the `add_credits` database function is missing.

## Solution

### Step 1: Run the Database Fix
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `fix-credit-functions.sql` and run it

This will create:
- The missing `add_credits` function
- The missing `use_credits` function  
- The `credit_transactions` table for tracking
- Proper RLS policies

### Step 2: Verify Stripe Webhook Configuration
Make sure your Stripe webhook is configured with these events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Step 3: Test the Fix
1. Use a Stripe test card (4242 4242 4242 4242)
2. Complete a subscription purchase
3. Check the webhook logs in Stripe dashboard
4. Verify credits are added to the user's account

### Step 4: Debugging
If credits still aren't being added, check:

1. **Webhook Logs**: Check Stripe dashboard for webhook delivery status
2. **Server Logs**: Look for errors in your server console
3. **Database**: Check if the `add_credits` function exists:
   ```sql
   SELECT routine_name FROM information_schema.routines WHERE routine_name = 'add_credits';
   ```
4. **User Lookup**: Verify the user exists in the profiles table with the correct email

### Common Issues
- **Webhook not receiving events**: Check webhook URL and events configuration
- **User not found**: Ensure user profile exists in database
- **Function doesn't exist**: Run the SQL fix script
- **RLS policies**: Make sure service role has proper permissions

## Testing
After applying the fix, test with:
- Basic plan subscription (should add 100 credits)
- Premium plan subscription (should add 300 credits)  
- Credit refill (should add 35 credits)
