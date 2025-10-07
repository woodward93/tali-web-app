import { useState, useEffect, createContext, useContext } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  image?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartItemCount: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    // Fallback implementation for when not using CartProvider
    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
      const saved = localStorage.getItem('shop-cart');
      return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
      localStorage.setItem('shop-cart', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (product: any, quantity: number) => {
      setCartItems(prev => {
        const existingItem = prev.find(item => item.id === product.id);
        if (existingItem) {
          const newQuantity = Math.min(existingItem.quantity + quantity, product.maxQuantity || 999);
          return prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: newQuantity }
              : item
          );
        }
        return [...prev, {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: Math.min(quantity, product.maxQuantity || 999),
          maxQuantity: product.maxQuantity || 999,
          image: product.images?.[0]
        }];
      });
    };

    const removeFromCart = (productId: string) => {
      setCartItems(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setCartItems(prev =>
        prev.map(item =>
          item.id === productId
            ? { ...item, quantity: Math.min(quantity, item.maxQuantity) }
            : item
        )
      );
    };

    const clearCart = () => {
      setCartItems([]);
    };

    const getCartItemCount = () => {
      return cartItems.reduce((total, item) => total + item.quantity, 0);
    };

    const getCartTotal = () => {
      return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    return {
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartItemCount,
      getCartTotal
    };
  }
  return context;
}