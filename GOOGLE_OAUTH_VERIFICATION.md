# Google OAuth Verification Guide

## Temporary access for Google reviewers (no payment required)

When Google's verification team tests your app, they cannot enter credit card information. To allow them to test the Gmail sync functionality (OAuth scope usage), enable the verification bypass:

### Steps

1. **Add environment variable in Vercel:**
   - Go to your Vercel project → **Settings** → **Environment Variables**
   - Add: `BYPASS_PAYMENT_FOR_VERIFICATION` = `true`
   - Apply to **Production** environment
   - **Redeploy** your app

2. **All users will temporarily have full access** (including sync) without paying.

3. **After Google approves your app**, remove the variable:
   - Delete `BYPASS_PAYMENT_FOR_VERIFICATION` from Vercel
   - Redeploy to restore the normal payment requirement

### What this does

- Session returns `hasAccess: true` for everyone
- Sync APIs allow all authenticated users
- Google reviewers can sign in, access the dashboard, and test the Gmail synchronization feature
