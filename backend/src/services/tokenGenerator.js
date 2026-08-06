const prisma = require('../database/prisma');

const MEAL_PREFIXES = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
  snacks: 'S',
};

/**
 * Generate daily sequential token number per meal type using MySQL atomic
 * ON DUPLICATE KEY UPDATE — fully race-condition-safe under concurrent requests.
 * Replaces MongoDB's findOneAndUpdate with $inc.
 *
 * @param {string} mealType - 'breakfast' | 'lunch' | 'dinner' | 'snacks'
 * @param {string} dateString - YYYY-MM-DD
 * @returns {Promise<{ tokenNumber: string, sequenceNumber: number }>}
 */
const generateTokenNumber = async (mealType, dateString) => {
  const cleanMeal = (mealType || 'breakfast').toLowerCase();
  const prefix = MEAL_PREFIXES[cleanMeal] || 'M';

  // Atomic increment: insert if not exists, else increment. Fully safe under concurrency.
  const nextSeq = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO DailyTokenCounter (meal_type, date, last_token_number)
      VALUES (${cleanMeal}, ${dateString}, 1)
      ON DUPLICATE KEY UPDATE last_token_number = last_token_number + 1
    `;

    const row = await tx.dailyTokenCounter.findUnique({
      where: { meal_type_date: { meal_type: cleanMeal, date: dateString } },
    });

    return row.last_token_number;
  });

  const tokenNumber = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

  return {
    tokenNumber,
    sequenceNumber: nextSeq,
  };
};

module.exports = {
  generateTokenNumber,
  MEAL_PREFIXES,
};
