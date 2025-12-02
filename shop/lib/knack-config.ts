// Knack Configuration - Field Mapping
// Updated with actual Knack object and field keys from Airsoft Database
// 
// SECURITY: API keys are only loaded from environment variables and never hardcoded
// This file should only be imported in server-side code (API routes, server components)

function requireEnvVar(name: string): string {
  // Only check on server-side (where process.env is available)
  if (typeof window !== 'undefined') {
    // Client-side: return empty string (will be checked when actually used)
    return ''
  }
  
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set it in your .env.local file or production environment.`
    )
  }
  return value
}

// Lazy getters for API keys - only accessed when actually needed (server-side)
function getApplicationId(): string {
  const value = process.env.KNACK_APPLICATION_ID
  if (!value) {
    throw new Error(
      'Missing required environment variable: KNACK_APPLICATION_ID. ' +
      'Please set it in your .env.local file or production environment.'
    )
  }
  return value
}

function getApiKey(): string {
  const value = process.env.KNACK_REST_API_KEY
  if (!value) {
    throw new Error(
      'Missing required environment variable: KNACK_REST_API_KEY. ' +
      'Please set it in your .env.local file or production environment.'
    )
  }
  return value
}

export const KNACK_CONFIG = {
  // Application Settings - Lazy-loaded getters (only accessed server-side)
  get applicationId() {
    return getApplicationId()
  },
  get apiKey() {
    return getApiKey()
  },

  // Object Keys - Updated from Knack Builder
  objectKeys: {
    accounts: process.env.KNACK_OBJECT_KEY_ACCOUNTS || 'object_2', // Accounts (User Role)
    users: process.env.KNACK_OBJECT_KEY_USERS || 'object_8', // User (User Role)
    products: process.env.KNACK_OBJECT_KEY_PRODUCTS || 'object_6',
    variants: process.env.KNACK_OBJECT_KEY_VARIANTS || 'object_7',
    orders: process.env.KNACK_OBJECT_KEY_ORDERS || 'object_10',
    clips: process.env.KNACK_OBJECT_KEY_CLIPS || 'object_11',
    signups: process.env.KNACK_OBJECT_KEY_SIGNUPS || 'object_12',
  },

  // Field Mappings - Updated with actual field keys from Knack Builder
  fields: {
    // Accounts Object Fields (object_2)
    accounts: {
      name: process.env.KNACK_FIELD_ACCOUNTS_NAME || 'field_14',
      email: process.env.KNACK_FIELD_ACCOUNTS_EMAIL || 'field_15',
      password: process.env.KNACK_FIELD_ACCOUNTS_PASSWORD || 'field_16',
      userRoles: process.env.KNACK_FIELD_ACCOUNTS_USER_ROLES || 'field_22',
      userStatus: process.env.KNACK_FIELD_ACCOUNTS_USER_STATUS || 'field_23',
    },

    // Users Object Fields (object_8)
    users: {
      displayName: process.env.KNACK_FIELD_USERS_DISPLAY_NAME || 'field_87',
      name: process.env.KNACK_FIELD_USERS_NAME || 'field_71',
      userId: process.env.KNACK_FIELD_USERS_USER_ID || 'field_85',
      role: process.env.KNACK_FIELD_USERS_ROLE || 'field_90',
      email: process.env.KNACK_FIELD_USERS_EMAIL || 'field_72',
      password: process.env.KNACK_FIELD_USERS_PASSWORD || 'field_73',
      userStatus: process.env.KNACK_FIELD_USERS_USER_STATUS || 'field_74',
      userRoles: process.env.KNACK_FIELD_USERS_USER_ROLES || 'field_75',
      phone: process.env.KNACK_FIELD_USERS_PHONE || 'field_89',
      isActive: process.env.KNACK_FIELD_USERS_IS_ACTIVE || 'field_91',
      createdAt: process.env.KNACK_FIELD_USERS_CREATED_AT || 'field_92',
      updatedAt: process.env.KNACK_FIELD_USERS_UPDATED_AT || 'field_93',
    },

    // Products Object Fields (object_6)
    products: {
      id: process.env.KNACK_FIELD_PRODUCTS_ID || 'field_45',
      sku: process.env.KNACK_FIELD_PRODUCTS_SKU || 'field_46',
      title: process.env.KNACK_FIELD_PRODUCTS_TITLE || 'field_47',
      titleOriginal: process.env.KNACK_FIELD_PRODUCTS_TITLE_ORIGINAL || 'field_48',
      description: process.env.KNACK_FIELD_PRODUCTS_DESCRIPTION || 'field_49',
      category: process.env.KNACK_FIELD_PRODUCTS_CATEGORY || 'field_50',
      status: process.env.KNACK_FIELD_PRODUCTS_STATUS || 'field_51',
      priceCadBase: process.env.KNACK_FIELD_PRODUCTS_PRICE_CAD_BASE || 'field_138',
      margin: process.env.KNACK_FIELD_PRODUCTS_MARGIN || 'field_53',
      stock: process.env.KNACK_FIELD_PRODUCTS_STOCK || 'field_54',
      url: process.env.KNACK_FIELD_PRODUCTS_URL || 'field_55',
      primaryImage: process.env.KNACK_FIELD_PRODUCTS_PRIMARY_IMAGE || 'field_56',
      images: process.env.KNACK_FIELD_PRODUCTS_IMAGES || 'field_57',
      detailImage: process.env.KNACK_FIELD_PRODUCTS_DETAIL_IMAGE || 'field_58',
      createdAt: process.env.KNACK_FIELD_PRODUCTS_CREATED_AT || 'field_59',
      updatedAt: process.env.KNACK_FIELD_PRODUCTS_UPDATED_AT || 'field_60',
    },

    // Variants Object Fields (object_7)
    variants: {
      product: process.env.KNACK_FIELD_VARIANTS_PRODUCT || 'field_61', // Connection to products
      variantName: process.env.KNACK_FIELD_VARIANTS_VARIANT_NAME || 'field_62',
      sku: process.env.KNACK_FIELD_VARIANTS_SKU || 'field_63',
      priceCny: process.env.KNACK_FIELD_VARIANTS_PRICE_CNY || 'field_64',
      priceCad: process.env.KNACK_FIELD_VARIANTS_PRICE_CAD || 'field_138',
      stock: process.env.KNACK_FIELD_VARIANTS_STOCK || 'field_66',
      status: process.env.KNACK_FIELD_VARIANTS_STATUS || 'field_67',
      sortOrder: process.env.KNACK_FIELD_VARIANTS_SORT_ORDER || 'field_68',
      createdAt: process.env.KNACK_FIELD_VARIANTS_CREATED_AT || 'field_69',
      updatedAt: process.env.KNACK_FIELD_VARIANTS_UPDATED_AT || 'field_70',
      // Multi-dimensional variant option fields (Color + Size selection)
      optionType1: 'field_145',   // e.g., "Color", "Style"
      optionValue1: 'field_146',  // e.g., "Black", "Standard"
      optionType2: 'field_147',   // e.g., "Size" (nullable)
      optionValue2: 'field_148',  // e.g., "M", "85-125cm" (nullable)
    },

    // Orders Object Fields (object_10)
    orders: {
      orderNumber: process.env.KNACK_FIELD_ORDERS_ORDER_NUMBER || 'field_94',
      userId: process.env.KNACK_FIELD_ORDERS_USER_ID || 'field_95', // Connection to User
      userEmail: process.env.KNACK_FIELD_ORDERS_USER_EMAIL || '', // Optional: Add field key if you have this field
      customerName: process.env.KNACK_FIELD_ORDERS_CUSTOMER_NAME || '', // Optional: Add field key if you have this field
      customerPhone: process.env.KNACK_FIELD_ORDERS_CUSTOMER_PHONE || '', // Optional: Add field key if you have this field
      items: process.env.KNACK_FIELD_ORDERS_ITEMS || 'field_96', // Connection to variants
      subtotalCad: process.env.KNACK_FIELD_ORDERS_SUBTOTAL_CAD || 'field_97',
      shippingCad: process.env.KNACK_FIELD_ORDERS_SHIPPING_CAD || 'field_98',
      totalCad: process.env.KNACK_FIELD_ORDERS_TOTAL_CAD || 'field_99',
      paymentMethod: process.env.KNACK_FIELD_ORDERS_PAYMENT_METHOD || 'field_100',
      paymentStatus: process.env.KNACK_FIELD_ORDERS_PAYMENT_STATUS || 'field_101',
      etransferRef: process.env.KNACK_FIELD_ORDERS_ETRANSFER_REF || 'field_102',
      paymentReceivedAt: process.env.KNACK_FIELD_ORDERS_PAYMENT_RECEIVED_AT || 'field_103',
      status: process.env.KNACK_FIELD_ORDERS_STATUS || 'field_104',
      shippingInfo: process.env.KNACK_FIELD_ORDERS_SHIPPING_INFO || 'field_105',
      pickupInfo: process.env.KNACK_FIELD_ORDERS_PICKUP_INFO || 'field_106',
      dropoffInfo: process.env.KNACK_FIELD_ORDERS_DROPOFF_INFO || 'field_107',
      taobaoInfo: process.env.KNACK_FIELD_ORDERS_TAOBAO_INFO || 'field_108',
      statusHistory: process.env.KNACK_FIELD_ORDERS_STATUS_HISTORY || 'field_109',
      createdAt: process.env.KNACK_FIELD_ORDERS_CREATED_AT || 'field_110',
      updatedAt: process.env.KNACK_FIELD_ORDERS_UPDATED_AT || 'field_111',
    },

    // Clips Object Fields (object_11)
    clips: {
      userId: process.env.KNACK_FIELD_CLIPS_USER_ID || 'field_112', // Connection to User
      username: process.env.KNACK_FIELD_CLIPS_USERNAME || 'field_113',
      userAvatar: process.env.KNACK_FIELD_CLIPS_USER_AVATAR || 'field_114',
      title: process.env.KNACK_FIELD_CLIPS_TITLE || 'field_115',
      description: process.env.KNACK_FIELD_CLIPS_DESCRIPTION || 'field_116',
      youtubeUrl: process.env.KNACK_FIELD_CLIPS_YOUTUBE_URL || 'field_117',
      youtubeId: process.env.KNACK_FIELD_CLIPS_YOUTUBE_ID || 'field_118',
      tags: process.env.KNACK_FIELD_CLIPS_TAGS || 'field_119',
      likes: process.env.KNACK_FIELD_CLIPS_LIKES || 'field_120',
      likedBy: process.env.KNACK_FIELD_CLIPS_LIKED_BY || 'field_121', // Connection to User
      date: process.env.KNACK_FIELD_CLIPS_DATE || 'field_122',
      timestamp: process.env.KNACK_FIELD_CLIPS_TIMESTAMP || 'field_123',
      createdAt: process.env.KNACK_FIELD_CLIPS_CREATED_AT || 'field_124',
      updatedAt: process.env.KNACK_FIELD_CLIPS_UPDATED_AT || 'field_125',
    },

    // Signups Object Fields (object_12)
    signups: {
      userId: process.env.KNACK_FIELD_SIGNUPS_USER_ID || 'field_126', // Connection to User
      username: process.env.KNACK_FIELD_SIGNUPS_USERNAME || 'field_127',
      email: process.env.KNACK_FIELD_SIGNUPS_EMAIL || 'field_128',
      isGuest: process.env.KNACK_FIELD_SIGNUPS_IS_GUEST || 'field_129',
      sponsorUserId: process.env.KNACK_FIELD_SIGNUPS_SPONSOR_USER_ID || 'field_130',
      date: process.env.KNACK_FIELD_SIGNUPS_DATE || 'field_131',
      timestamp: process.env.KNACK_FIELD_SIGNUPS_TIMESTAMP || 'field_132',
      createdAt: process.env.KNACK_FIELD_SIGNUPS_CREATED_AT || 'field_133',
    },
  },
}

/**
 * Helper function to get field value from Knack record
 * Handles both field keys (field_1) and field names (Title)
 */
export function getFieldValue(record: Record<string, unknown>, fieldKey: string, fieldName?: string): unknown {
  // Skip if field key is empty (optional fields)
  if (!fieldKey) return undefined
  // Try field key first
  if (record[fieldKey] !== undefined && record[fieldKey] !== null) return record[fieldKey]
  // Try field name if provided
  if (fieldName && record[fieldName] !== undefined && record[fieldName] !== null) return record[fieldName]
  // Return undefined if neither found
  return undefined
}

/**
 * Helper function to set field value in Knack record format
 */
export function setFieldValue(data: Record<string, unknown>, fieldKey: string, value: unknown): void {
  data[fieldKey] = value
}
