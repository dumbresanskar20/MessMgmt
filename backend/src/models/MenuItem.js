const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    image_url: {
      type: String,
      default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    },
    cloudinary_public_id: {
      type: String,
      default: null,
    },
    meal_type: {
      type: String,
      required: [true, 'Meal type is required'],
      enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

menuItemSchema.index({ meal_type: 1, is_active: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
