const fs = require('fs');
const path = require('path');

const envConfig = `
window.ENV = {
  FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY || ''}",
  FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
  FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID || ''}",
  FIREBASE_STORAGE_BUCKET: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
  FIREBASE_MESSAGING_SENDER_ID: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
  FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID || ''}"
};
`;

const targetPath = path.join(__dirname, '../js/env.js');
fs.writeFileSync(targetPath, envConfig);
console.log('✅ Đã inject thành công biến môi trường vào js/env.js');
console.log(envConfig);