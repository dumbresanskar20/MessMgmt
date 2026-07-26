const Counter = require('../models/Counter');

const MEAL_PREFIXES = {
  breakfast: 'B',
  lunch: 'L',
  dinner: 'D',
  snacks: 'S',
};

/**
 * Generate daily sequential token number per meal type using atomic MongoDB findOneAndUpdate with $inc
 * @param {string} mealType - 'breakfast' | 'lunch' | 'dinner' | 'snacks'
 * @param {string} dateString - YYYY-MM-DD
 * @returns {Promise<{ tokenNumber: string, sequenceNumber: number }>}
 */
const generateTokenNumber = async (mealType, dateString) => {
  const cleanMeal = (mealType || 'breakfast').toLowerCase();
  const prefix = MEAL_PREFIXES[cleanMeal] || 'M';
  const counterId = `token_${cleanMeal}_${dateString}`;

  // Database-level atomic sequence increment
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const nextSequence = counter.seq;
  const tokenNumber = `${prefix}-${String(nextSequence).padStart(3, '0')}`;

  return {
    tokenNumber,
    sequenceNumber: nextSequence,
  };
};

module.exports = {
  generateTokenNumber,
  MEAL_PREFIXES,
};
