import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const CartContext = createContext();

const ANONYMOUS_CART_KEY = 'mess_cart';

const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage removeItem failed:', e);
    }
  },
};

export const CartProvider = ({ children }) => {
  const { student, isAuthenticated } = useAuth();
  const [selectedMealType, setSelectedMealTypeState] = useState('breakfast');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  
  // Dynamic Meal Windows State
  const [mealWindows, setMealWindows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(true);
  const [redirectNotice, setRedirectNotice] = useState(null);

  // Determine current cart key based on user login status
  const studentId = student?.id || student?._id;
  const cartKey = isAuthenticated && studentId ? `mess_cart_${studentId}` : ANONYMOUS_CART_KEY;

  // Initialize cart state synchronously from localStorage on app load / page refresh
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedUser = safeLocalStorage.getItem('student_user');
      let initialKey = ANONYMOUS_CART_KEY;

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const savedId = parsedUser?.id || parsedUser?._id;
        if (savedId) {
          initialKey = `mess_cart_${savedId}`;
        }
      }

      const savedCart = safeLocalStorage.getItem(initialKey);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }

      const anonCart = safeLocalStorage.getItem(ANONYMOUS_CART_KEY);
      if (anonCart) {
        const parsedAnon = JSON.parse(anonCart);
        if (Array.isArray(parsedAnon)) return parsedAnon;
      }

      return [];
    } catch (err) {
      console.warn('Error reading initial cart from localStorage:', err);
      return [];
    }
  });

  // Fetch dynamic meal types & windows from single source of truth API
  const fetchMealWindows = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingWindows(true);
    try {
      const res = await api.get('/menu/windows');
      if (res.data.success && Array.isArray(res.data.windows)) {
        setMealWindows(res.data.windows);
        
        const activeTypes = res.data.windows
          .filter((w) => w.is_active !== false)
          .map((w) => w.meal_type.toLowerCase());

        // Auto-redirect if selected meal type is turned OFF
        if (activeTypes.length > 0 && !activeTypes.includes(selectedMealType.toLowerCase())) {
          const fallbackType = activeTypes[0];
          const oldName = selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1);
          const newName = fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1);

          setSelectedMealTypeState(fallbackType);
          setRedirectNotice(`${oldName} isn't available right now — check out today's ${newName} menu!`);
          setTimeout(() => setRedirectNotice(null), 5000);
        }
      }
    } catch (err) {
      console.warn('Could not fetch meal windows, using defaults:', err);
    } finally {
      if (!isSilent) setLoadingWindows(false);
    }
  }, [selectedMealType]);

  useEffect(() => {
    fetchMealWindows();

    // Auto-refresh meal window timings & open status every 60 seconds or on window focus
    const interval = setInterval(() => {
      fetchMealWindows(true);
    }, 60000);

    const handleFocus = () => fetchMealWindows(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchMealWindows]);

  const setSelectedMealType = (type) => {
    const target = type.toLowerCase();
    const windowItem = mealWindows.find((w) => w.meal_type.toLowerCase() === target);
    
    if (windowItem && windowItem.is_active === false) {
      const activeTypes = mealWindows
        .filter((w) => w.is_active !== false)
        .map((w) => w.meal_type.toLowerCase());
      
      const fallbackType = activeTypes.length > 0 ? activeTypes[0] : 'breakfast';
      const oldName = type.charAt(0).toUpperCase() + type.slice(1);
      const newName = fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1);

      setSelectedMealTypeState(fallbackType);
      setRedirectNotice(`${oldName} isn't available right now — check out today's ${newName} menu!`);
      setTimeout(() => setRedirectNotice(null), 5000);
      return;
    }

    setSelectedMealTypeState(target);
  };

  // Handle Login Cart Merge: Merge anonymous cart into student cart upon login
  useEffect(() => {
    if (isAuthenticated && studentId) {
      try {
        const studentCartKey = `mess_cart_${studentId}`;
        const studentSaved = safeLocalStorage.getItem(studentCartKey);
        const anonSaved = safeLocalStorage.getItem(ANONYMOUS_CART_KEY);

        let studentCart = studentSaved ? JSON.parse(studentSaved) : [];
        let anonCart = anonSaved ? JSON.parse(anonSaved) : [];

        if (Array.isArray(anonCart) && anonCart.length > 0) {
          const merged = [...studentCart];
          anonCart.forEach((anonItem) => {
            const index = merged.findIndex((i) => i.id === anonItem.id || i.menu_item === anonItem.menu_item);
            if (index > -1) {
              merged[index].quantity += anonItem.quantity;
            } else {
              merged.push(anonItem);
            }
          });
          studentCart = merged;
          safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
        }

        setCartItems(studentCart);
        safeLocalStorage.setItem(studentCartKey, JSON.stringify(studentCart));
      } catch (err) {
        console.warn('Error merging cart on login:', err);
      }
    }
  }, [isAuthenticated, studentId]);

  // Sync cart items to localStorage on every state update
  useEffect(() => {
    safeLocalStorage.setItem(cartKey, JSON.stringify(cartItems));
  }, [cartItems, cartKey]);

  const triggerCartPulse = () => {
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 400);
  };

  const addToCart = (item, quantity = 1) => {
    setCartItems((prev) => {
      const targetId = item._id || item.id || item.menu_item;
      const existingIndex = prev.findIndex((i) => i.id === targetId || i.menu_item === targetId);

      let updated;
      if (existingIndex > -1) {
        updated = [...prev];
        updated[existingIndex].quantity += quantity;
      } else {
        updated = [
          ...prev,
          {
            id: targetId,
            menu_item: targetId,
            name: item.name,
            price: Number(item.price),
            quantity: Number(quantity),
            image_url: item.image_url,
            meal_type: item.meal_type || selectedMealType,
          },
        ];
      }

      safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      return updated;
    });

    triggerCartPulse();
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) => {
      const updated = prev.filter((i) => i.id !== itemId && i.menu_item !== itemId);
      safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      return updated;
    });
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((prev) => {
      const updated = prev.map((i) => (i.id === itemId || i.menu_item === itemId ? { ...i, quantity: Number(quantity) } : i));
      safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear cart from state & localStorage ONLY on explicit removal or successful checkout
  const clearCart = () => {
    setCartItems([]);
    safeLocalStorage.removeItem(cartKey);
    safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

  // Active meal windows only
  const activeMealWindows = mealWindows.filter((w) => w.is_active !== false);
  const allMealsInactive = !loadingWindows && mealWindows.length > 0 && activeMealWindows.length === 0;
  const currentMealWindow = mealWindows.find((w) => w.meal_type.toLowerCase() === selectedMealType.toLowerCase());

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        selectedMealType,
        setSelectedMealType,
        mealWindows,
        activeMealWindows,
        currentMealWindow,
        loadingWindows,
        allMealsInactive,
        redirectNotice,
        setRedirectNotice,
        fetchMealWindows,
        isCartOpen,
        setIsCartOpen,
        isCartBouncing,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        triggerCartPulse,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
