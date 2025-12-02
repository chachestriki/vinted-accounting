# MongoDB Setup Guide

## Step 1: Get Your MongoDB Connection String

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click on your cluster
3. Click the **"Connect"** button
4. Select **"Connect your application"**
5. Copy the connection string (it looks like this):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` and `<password>` with your actual database user credentials
7. **Important**: Add a database name at the end. For example:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/contapp?retryWrites=true&w=majority
   ```
   (Replace `contapp` with your preferred database name)

## Step 2: Configure Environment Variables

1. Create a `.env.local` file in the root of your project (if it doesn't exist)
2. Add the following line:
   ```
   MONGODB_URI=your_connection_string_here
   ```
   Replace `your_connection_string_here` with the connection string from Step 1

3. Your `.env.local` file should look something like this:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/contapp?retryWrites=true&w=majority
   NEXTAUTH_SECRET=your_nextauth_secret_here
   GOOGLE_ID=your_google_id
   GOOGLE_SECRET=your_google_secret
   RESEND_API_KEY=your_resend_key
   STRIPE_SECRET_KEY=your_stripe_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   ```

## Step 3: Network Access (Important!)

1. In MongoDB Atlas, go to **Network Access** (left sidebar)
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, restrict this to your server's IP address
4. Click **"Confirm"**

## Step 4: Database Collections (Automatic)

**You don't need to manually create any tables or collections!** MongoDB will automatically create them when your app first uses them. Here's what will be created:

### Collections Created Automatically:

1. **`users`** - Created by the User model (`models/User.ts`)
   - Stores: name, email, image, customerId, priceId, hasAccess
   - Created when users sign up or authenticate

2. **`leads`** - Created by the Lead model (`models/Lead.ts`)
   - Stores: email addresses from your landing page
   - Created when someone submits their email via the lead form

3. **NextAuth Collections** (created automatically by NextAuth):
   - `accounts` - OAuth account information
   - `sessions` - User sessions
   - `verification_tokens` - Email verification tokens

## Step 5: Verify the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. The app will automatically connect to MongoDB when:
   - A user signs up or logs in
   - An API route that uses the database is called
   - The app tries to save data

3. Check your MongoDB Atlas dashboard:
   - Go to **"Browse Collections"** in your cluster
   - You should see collections appear as they're created

## Troubleshooting

### Connection Error?
- Verify your connection string is correct
- Check that your IP address is whitelisted in Network Access
- Ensure your database user has proper permissions
- Make sure the database name is included in the connection string

### Collections Not Appearing?
- Collections are created lazily (only when data is inserted)
- Try signing up a user or submitting a lead form
- Check the browser console and server logs for errors

## Next Steps

Once MongoDB is connected:
- ✅ Users can sign up and log in
- ✅ Lead collection forms will work
- ✅ Stripe webhooks can update user access
- ✅ All database operations will function properly

No additional setup is required - the app handles everything automatically!

