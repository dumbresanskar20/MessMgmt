import React, { useState, useEffect } from 'react';
import ScrollFoodScene from './ScrollFoodScene';
import { Sparkles, Utensils, Flame, ChevronRight } from 'lucide-react';

export default function Hero3D() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = Math.max(1, window.innerHeight * 1.2);
      const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate dynamic warm gradient style shifting based on scroll progress
  const gradientHueShift = Math.round(scrollProgress * 20); // 0 to 20 degree shift

  return (
    <div
      className="relative overflow-hidden transition-colors duration-500 py-12 md:py-16"
      style={{
        background: `linear-gradient(135deg, rgba(254,243,199, ${0.7 - scrollProgress * 0.2}) 0%, rgba(255,237,213, ${0.6 - scrollProgress * 0.2}) 50%, rgba(254,242,242, 0.8) 100%)`,
      }}
    >
      {/* Scroll-Reactive Background Glowing Orbs */}
      <div
        className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-gradient-to-tr from-amber-300/40 to-orange-400/30 blur-3xl pointer-events-none transition-transform duration-300"
        style={{
          transform: `translate(${scrollProgress * 40}px, ${scrollProgress * 30}px) scale(${1 + scrollProgress * 0.15})`,
        }}
      />
      <div
        className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-gradient-to-bl from-orange-400/30 to-amber-200/40 blur-3xl pointer-events-none transition-transform duration-300"
        style={{
          transform: `translate(${-scrollProgress * 50}px, ${scrollProgress * 40}px) scale(${1 - scrollProgress * 0.1})`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Text Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-amber-100/90 border border-amber-300 text-brand-terracotta text-xs md:text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm">
              <Sparkles className="w-4 h-4 text-brand-orange animate-spin" style={{ animationDuration: '6s' }} />
              <span>Piping Hot & Fresh Daily • Campus Canteen</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-brand-dark leading-[1.15]">
              Delicious Meals, <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange via-amber-600 to-brand-terracotta">
                Zero Waiting Time.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Browse breakfast & lunch, pick your tray, and get instant digital meal tokens right on your phone. Fresh, hygienic, and prepared with love.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#menu-section"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-base px-7 py-3.5 rounded-2xl shadow-warm hover:shadow-cardHover hover:scale-[1.02] transition-all duration-200"
              >
                <Utensils className="w-5 h-5" />
                Explore Today's Menu
              </a>

              <div className="flex items-center gap-3 text-xs sm:text-sm font-medium text-stone-600 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-2xl border border-amber-100 shadow-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Kitchen Live • Accepting Orders</span>
              </div>
            </div>

            {/* Micro Feature Badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 max-w-md mx-auto lg:mx-0 text-center">
              <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-amber-100/80">
                <span className="block font-bold font-display text-lg text-brand-orange">B-001</span>
                <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">Live Tokens</span>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-amber-100/80">
                <span className="block font-bold font-display text-lg text-emerald-700">⚡ 3 Mins</span>
                <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">Average Prep</span>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-amber-100/80">
                <span className="block font-bold font-display text-lg text-amber-600">100% Veg</span>
                <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">Hygienic</span>
              </div>
            </div>
          </div>

          {/* Right 3D Scroll-Driven Photorealistic Scene Container */}
          <div className="lg:col-span-5 relative h-[340px] sm:h-[400px] lg:h-[460px] w-full flex items-center justify-center">
            {/* Scroll-Linked 3D Canvas Scene */}
            <ScrollFoodScene scrollProgress={scrollProgress} />
          </div>

        </div>
      </div>
    </div>
  );
}
