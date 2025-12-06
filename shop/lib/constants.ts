// Store configuration constants
export const STORE_EMAIL = "protocolzeroairsoft@gmail.com"
export const SECURITY_QUESTION = "Order ID?"
export const SECURITY_ANSWER = "See order confirmation"

// Admin configuration
// Emails allowed to access admin-only APIs and dashboards
// Only Forest is an admin. Update this list to grant/revoke access.
export const ADMIN_EMAILS: string[] = [
	'forestli009@gmail.com',
]

// Supported pickup/drop-off locations
export const PICKUP_LOCATIONS = [
	{
		id: 'ultimate-airsoft',
		label: 'Ultimate Airsoft',
	},
	{
		id: 'reception',
		label: 'Reception/Front Desk',
	},
]
