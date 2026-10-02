import fs from 'node:fs';
import path from 'node:path';

const testDatabasePath = path.resolve(process.cwd(), 'prisma', 'test.db');
fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
fs.closeSync(fs.openSync(testDatabasePath, 'a'));
