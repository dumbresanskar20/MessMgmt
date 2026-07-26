import React, { useState, useRef } from 'react';
import { Plus, Check, Flame, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MenuCard({ item, isCurrentlyOpen = true }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const cardRef = useRef(null);

  // 3D Tilt Effect calculations
  const [transformStyle, setTransformStyle] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setTransformStyle(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const handleAdd = () => {
    if (!isCurrentlyOpen) return;
    addToCart(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform: transformStyle, transition: 'transform 0.15s ease-out' }}
      className={`group relative bg-white rounded-3xl overflow-hidden border transition-all flex flex-col justify-between ${
        !isCurrentlyOpen
          ? 'border-stone-200/80 bg-stone-50/40 opacity-90'
          : 'border-amber-100/80 shadow-warm hover:shadow-cardHover'
      }`}
    >
      {/* Top Food Image Container */}
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-100">
        <img
          src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
          alt={item.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            isCurrentlyOpen ? 'group-hover:scale-110' : 'grayscale-25'
          }`}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Meal Category Badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-brand-terracotta text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
          <Flame className="w-3 h-3 text-brand-orange" />
          <span>{item.meal_type}</span>
        </div>

        {/* Price Tag Overlay */}
        <div className="absolute bottom-3 right-3 bg-brand-dark/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl font-display font-extrabold text-lg shadow-lg">
          ₹{item.price}
        </div>
      </div>

      {/* Item Details Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold font-display text-brand-dark group-hover:text-brand-orange transition-colors leading-snug">
            {item.name}
          </h3>
          <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
            {item.description || 'Piping hot authentic preparation cooked fresh in the campus kitchen.'}
          </p>
        </div>

        {/* Add to Cart CTA */}
        <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
          {isCurrentlyOpen ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Fresh & Ready
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Browsing Only</span>
            </span>
          )}

          <button
            onClick={handleAdd}
            disabled={!isCurrentlyOpen || added}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 shadow-sm ${
              !isCurrentlyOpen
                ? 'bg-stone-200 text-stone-500 cursor-not-allowed border border-stone-300/60'
                : added
                ? 'bg-emerald-600 text-white scale-105'
                : 'bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white hover:scale-105 active:scale-95'
            }`}
          >
            {!isCurrentlyOpen ? (
              <>
                <Clock className="w-4 h-4 text-stone-400" />
                <span>Ordering Closed</span>
              </>
            ) : added ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added to Tray</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add to Tray</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
