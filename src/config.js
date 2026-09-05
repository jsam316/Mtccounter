// Deployment configuration.
//
// GOOGLE_CLIENT_ID — OAuth 2.0 Web client ID for Cloud backup to Google
// Drive. Leave empty to hide the cloud backup feature. This is a public
// identifier (not a secret); the protection is the "Authorized JavaScript
// origins" list on the client, which must include the site's origin.
// Setup steps: see README.md → "Cloud backup (Google Drive)".
export const GOOGLE_CLIENT_ID = '';
