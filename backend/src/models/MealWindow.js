const mongoose = require('mongoose');

const mealWindowSchema = new mongoose.Schema(
  {
    meal_type: {
      type: String,
      required: true,
      unique: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    },
    start_time: {
      type: String,
      required: true, // e.g. "07:30"
    },
    end_time: {
      type: String,
      required: true, // e.g. "10:00"
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_full_day: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

mealWindowSchema.index({ meal_type: 1, is_active: 1 });

module.exports = mongoose.model('MealWindow', mealWindowSchema);
