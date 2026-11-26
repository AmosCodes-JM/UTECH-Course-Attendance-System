// Provision an administrator account from the command line. This is the
// controlled way to create the first real admin in any environment - there is
// deliberately no public "register as admin" page or endpoint.
//
// Usage (from server/):
//   npm run create-admin -- --email ops@example.edu --work-id ADM100 --first Pat --last Lee
// The password is read from the ADMIN_PASSWORD environment variable if set,
// otherwise you are prompted for it (input hidden).
import readline from 'node:readline';
import { z } from 'zod';
import { hashPassword } from '../services/authService.js';
import { email, password, personName, workId } from '../utils/validators.js';
import { disconnectDatabase, prisma } from './client.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const schema = z.object({ email, workId, firstName: personName, lastName: personName, password });

async function main() {
  const input = {
    email: arg('email'),
    workId: arg('work-id'),
    firstName: arg('first'),
    lastName: arg('last'),
    password: process.env.ADMIN_PASSWORD ?? (await promptHidden('Password for the new administrator: ')),
  };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    console.error('Usage: npm run create-admin -- --email you@example.edu --work-id ADM100 --first Pat --last Lee');
    process.exitCode = 1;
    return;
  }

  const { password: plain, ...data } = parsed.data;
  const clash = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { workId: data.workId }] } });
  if (clash) {
    console.error('A user with that email or work ID already exists.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.create({ data: { ...data, role: 'ADMIN', passwordHash: await hashPassword(plain) } });
  console.log(`Administrator created: ${user.firstName} ${user.lastName} <${user.email}> (work ID ${user.workId}).`);
}

main()
  .catch((err) => {
    console.error('Could not create administrator:', err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
