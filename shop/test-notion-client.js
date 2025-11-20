import { Client } from '@notionhq/client';
const c = new Client({ auth: 'test' });
console.log('✓ Client created');
console.log('databases methods:', Object.keys(c.databases));
console.log('Has databases.query?', typeof c.databases.query);
