# 🚀 Pre-Launch Checklist for Protocol Zero Shop

## ✅ Environment Variables & Configuration

### Required Environment Variables

Create a `.env.local` file in the `shop/` directory with:

#### **Knack Database** (Primary backend)
```bash
# Knack API Configuration
KNACK_APPLICATION_ID=your_knack_app_id
KNACK_REST_API_KEY=your_knack_rest_api_key

# Optional: Override default object/field keys if needed
# KNACK_OBJECT_KEY_PRODUCTS=object_6
# KNACK_FIELD_PRODUCTS_TITLE=field_47
# ... (see shop/lib/knack-config.ts for all options)
```

#### **Firebase** (Authentication & optional Firestore)
```bash
# Firebase Client Configuration (for auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id  # Optional: for Analytics
```

#### **Notion** (Optional - only if not using Knack)
```bash
# Only needed if USE_KNACK_DATABASE=false
NOTION_DATABASE_ID_PRODUCTS=your_notion_products_db_id
NOTION_DATABASE_ID_VARIANTS=your_notion_variants_db_id
NOTION_API_KEY=your_notion_api_key
```

#### **Database Selection**
```bash
# Set to 'true' to use Knack, 'false' to use Notion/Firestore
USE_KNACK_DATABASE=true
```

---

## 📦 Database Setup

### **Knack Database** (Recommended)
- [ ] Products imported to Knack (object_6)
- [ ] Variants imported to Knack (object_7)
- [ ] Users object configured (object_8)
- [ ] Orders object configured (object_10)
- [ ] Clips object configured (object_11) - if using clips feature
- [ ] Signups object configured (object_12) - if using signups feature
- [ ] Field mappings verified in `shop/lib/knack-config.ts`
- [ ] Test API connection: `npm run dev` and check for errors

### **Notion Database** (Alternative)
- [ ] Products database created and configured
- [ ] Variants database created and configured
- [ ] Notion API key with access to databases
- [ ] Test connection works

---

## 🔐 Authentication Setup

### **Firebase Authentication**
- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Auth domain configured
- [ ] Test signup/login flow works
- [ ] Password reset email configured
- [ ] (Optional) OAuth providers configured (Google, etc.)

---

## 💳 Payment Processing

### **Current Implementation: E-Transfer**
- [ ] E-transfer email configured: `protocolzeroairsoft@gmail.com`
- [ ] Payment instructions clear on checkout page
- [ ] Order confirmation emails set up (if using)
- [ ] Payment tracking workflow in place

### **Future: Payment Gateway** (Optional)
- [ ] Stripe/PayPal account set up
- [ ] Payment gateway integration implemented
- [ ] Webhook handlers for payment confirmations

---

## 🛍️ Product & Inventory

- [ ] All products imported to database
- [ ] Product images uploaded and accessible
- [ ] Variants properly linked to products
- [ ] Prices set correctly (CAD)
- [ ] Stock levels accurate
- [ ] Product descriptions complete
- [ ] SKUs unique and correct

---

## 🎨 UI/UX Polish

- [ ] Logo and branding assets in place
- [ ] Favicon configured
- [ ] Mobile responsive design tested
- [ ] Loading states for all async operations
- [ ] Error messages user-friendly
- [ ] Cart functionality tested
- [ ] Checkout flow tested end-to-end
- [ ] Order confirmation page works

---

## 📧 Communication

- [ ] Contact email configured (`protocolzeroairsoft@gmail.com`)
- [ ] Order confirmation emails (if implemented)
- [ ] Shipping notifications (if implemented)
- [ ] Customer support process defined

---

## 🔒 Security & Privacy

- [ ] `.env.local` in `.gitignore` ✅ (already done)
- [ ] No API keys in code ✅ (already done)
- [ ] HTTPS enabled (Vercel does this automatically)
- [ ] Privacy policy page (`/policies`) complete
- [ ] Terms of service (if needed)
- [ ] GDPR compliance (if serving EU customers)

---

## 🚀 Deployment

### **Vercel Deployment** (Recommended)
- [ ] Vercel account connected to GitHub
- [ ] Environment variables set in Vercel dashboard
- [ ] Build command: `npm run build` (or `npm run vercel-build`)
- [ ] Output directory: `.next`
- [ ] Node.js version: 18+ (check `package.json` engines if specified)
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate active

### **Build Test**
```bash
cd shop
npm install
npm run build
# Should complete without errors
```

---

## 🧪 Testing Checklist

### **Functional Testing**
- [ ] Homepage loads
- [ ] Shop page displays products
- [ ] Product detail page works
- [ ] Add to cart works
- [ ] Cart page shows items correctly
- [ ] Checkout form validation works
- [ ] Guest checkout works
- [ ] User signup works
- [ ] User login works
- [ ] Password reset works
- [ ] Order creation succeeds
- [ ] Order confirmation displays

### **Error Handling**
- [ ] Empty cart handled gracefully
- [ ] Network errors show user-friendly messages
- [ ] Invalid form inputs show errors
- [ ] Missing products handled
- [ ] Out of stock items handled

### **Browser Testing**
- [ ] Chrome/Edge
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 📊 Analytics & Monitoring

- [ ] Google Analytics or Vercel Analytics configured
- [ ] Error tracking (Sentry, etc.) - optional
- [ ] Performance monitoring - optional

---

## 📝 Documentation

- [ ] README updated with setup instructions
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Admin access instructions (if applicable)

---

## 🎯 Post-Launch

- [ ] Monitor error logs
- [ ] Check order processing workflow
- [ ] Verify payment confirmations
- [ ] Test customer support channels
- [ ] Set up backup/restore process for database

---

## ⚠️ Critical Issues to Fix Before Launch

1. **Environment Variables**: All required vars must be set
2. **Database Connection**: Must connect to Knack/Notion successfully
3. **Authentication**: Firebase auth must work
4. **Checkout Flow**: Must create orders successfully
5. **Product Data**: Products must display correctly
6. **Build Success**: `npm run build` must complete without errors

---

## 🔧 Quick Start Commands

```bash
# Install dependencies
cd shop
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Run development server
npm run dev

# Build for production
npm run build

# Test production build locally
npm run start
```

---

## 📞 Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Knack API Docs**: https://docs.knack.com/docs/rest-api

---

**Last Updated**: 2025-01-26
**Status**: Pre-Launch Checklist





