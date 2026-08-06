const bcrypt = require('bcryptjs');
const prisma = require('./src/database/prisma');

async function main() {
  // Read parameters from env or fallback to defaults
  const username = process.env.OWNER_USERNAME || 'owner';
  const email = process.env.OWNER_EMAIL || 'owner@mess.com';
  const password = process.env.OWNER_PASS || 'owner123';

  console.log(`Checking if owner account '${username}' or '${email}' already exists...`);

  const existingEmail = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  const existingUsername = await prisma.adminUser.findUnique({
    where: { username: username.toLowerCase().trim() }
  });

  if (existingEmail || existingUsername) {
    console.log('Owner account already exists or email/username is in use by another admin.');
    
    // If it exists, let's update it to ensure it is role: 'owner', is_active: true, is_verified: true
    const target = existingEmail || existingUsername;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await prisma.adminUser.update({
      where: { id: target.id },
      data: {
        role: 'owner',
        is_verified: true,
        is_active: true,
        password_hash: hashedPassword,
      }
    });
    console.log(`Updated existing account ID ${target.id} to be Owner role with password '${password}'.`);
    return;
  }

  console.log('Creating owner account...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const owner = await prisma.adminUser.create({
    data: {
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      role: 'owner',
      is_active: true,
      is_verified: true,
    }
  });

  console.log('\n========================================');
  console.log('🎉 Developer OWNER account seeded successfully!');
  console.log(`Username: ${owner.username}`);
  console.log(`Email:    ${owner.email}`);
  console.log(`Password: ${password}`);
  console.log('========================================\n');
}

main()
  .catch((err) => console.error('Error seeding owner:', err))
  .finally(() => prisma.$disconnect());
