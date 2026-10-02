import fs from 'node:fs';
import path from 'node:path';

const testDatabasePath = path.resolve(process.cwd(), 'prisma', 'test.db');
const prismaDirectory = path.resolve(process.cwd(), 'prisma');

if (path.dirname(testDatabasePath) !== prismaDirectory || path.basename(testDatabasePath) !== 'test.db') {
  throw new Error(`Refusing to reset unexpected test database path: ${testDatabasePath}`);
}

fs.mkdirSync(prismaDirectory, { recursive: true });
for (const testArtifact of [
  testDatabasePath,
  `${testDatabasePath}-journal`,
  `${testDatabasePath}-shm`,
  `${testDatabasePath}-wal`,
]) {
  fs.rmSync(testArtifact, { force: true });
}
// Prisma's Windows SQLite engine expects the database file to exist before db push.
fs.closeSync(fs.openSync(testDatabasePath, 'a'));
