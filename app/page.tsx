'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const INITIAL_PRODUCTS = [
  { 
    id: 1, name: 'ELFBAR 5000', category: 'Одноразки', price: 15, image: null,
    flavors: [
      { name: 'Манго', stock: 15 }, { name: 'Виноград', stock: 8 }, { name: 'Холодок', stock: 0 },
      { name: 'Яблоко', stock: 12 }, { name: 'Персик', stock: 5 }, { name: 'Клубника', stock: 0 },
      { name: 'Арбуз', stock: 7 },
    ]
  },
  { 
    id: 2, name: 'Жидкость Mango Ice 100ml', category: 'Жидкости', price: 8, image: null,
    flavors: [{ name: '3mg', stock: 20 }, { name: '6mg', stock: 15 }, { name: '12mg', stock: 0 }]
  },
  { 
    id: 3, name: 'XROS 3 Pod System', category: 'POD-системы', price: 25, image: null,
    flavors: [{ name: 'Чёрный', stock: 10 }, { name: 'Серебристый', stock: 8 }, { name: 'Розовый', stock: 5 }]
  },
  { 
    id: 4, name: 'Снюс Nordic Spirit', category: 'Снюс', price: 3.5, image: null,
    flavors: [
      { name: 'Мята', stock: 25 }, { name: 'Ягоды', stock: 18 }, { name: 'Цитрус', stock: 0 },
      { name: 'Кола', stock: 12 }, { name: 'Манго', stock: 9 }, { name: 'Арбуз', stock: 14 },
      { name: 'Виноград', stock: 7 }, { name: 'Персик', stock: 11 },
    ]
  },
  { 
    id: 5, name: 'Кальян Alpha Hookah', category: 'Кальяны', price: 45, image: null,
    flavors: [{ name: 'Чёрный матовый', stock: 3 }, { name: 'Белый', stock: 2 }]
  },
  { 
    id: 6, name: 'Испаритель 0.4ohm', category: 'Расходники', price: 2.5, image: null,
    flavors: [{ name: 'Стандарт', stock: 50 }]
  },
  { 
    id: 7, name: 'HQD Cuvie Plus', category: 'Одноразки', price: 12, image: null,
    flavors: [{ name: 'Манго', stock: 20 }, { name: 'Виноград', stock: 15 }, { name: 'Холодок', stock: 10 }]
  },
  { 
    id: 8, name: 'Brusko Minican 3', category: 'POD-системы', price: 18, image: null,
    flavors: [
      { name: 'Чёрный', stock: 8 }, { name: 'Синий', stock: 6 }, { name: 'Красный', stock: 0 },
      { name: 'Зелёный', stock: 4 }, { name: 'Белый', stock: 10 }, { name: 'Розовый', stock: 7 },
    ]
  },
];

const CATEGORIES = ['Все', 'POD-системы', 'Жидкости', 'Расходники', 'Снюс', 'Одноразки', 'Кальяны', 'Другое'];

interface Flavor { name: string; stock: number; }
interface Product { id: number; name: string; category: string; price: number; image: string | null; flavors: Flavor[]; }
interface CartItem { productId: number; productName: string; flavor: string; price: number; quantity: number; image: string | null; }
interface Order { id: string; order_number: number; order_date: string; items: CartItem[]; total_price: number; created_at: string; }

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink: (url: string) => void;
        sendData: (data: string) => void;
        HapticFeedback: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
        };
        initDataUnsafe?: {
          user?: { id: number; username?: string; first_name?: string; last_name?: string; };
        };
        themeParams: { bg_color?: string; text_color?: string; };
      };
    };
  }
}

export default function Home() {
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);
  const [ageDeclined, setAgeDeclined] = useState(false);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [showAllFlavors, setShowAllFlavors] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Telegram интеграция
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  }, []);

  // Проверка возраста
  useEffect(() => {
    const verified = localStorage.getItem('liqvape_age_verified');
    if (verified === 'true') setAgeVerified(true);
    else if (verified === 'false') { setAgeVerified(false); setAgeDeclined(true); }
    else setAgeVerified(false);
  }, []);

  const confirmAge = (isAdult: boolean) => {
    localStorage.setItem('liqvape_age_verified', isAdult.toString());
    setAgeVerified(isAdult);
    if (!isAdult) setAgeDeclined(true);
  };

  // User ID
  useEffect(() => {
    let savedUserId = localStorage.getItem('liqvape_user_id');
    if (!savedUserId) {
      savedUserId = crypto.randomUUID();
      localStorage.setItem('liqvape_user_id', savedUserId);
    }
    setUserId(savedUserId);
  }, []);

  // Корзина
  useEffect(() => {
    const savedCart = localStorage.getItem('liqvape_cart');
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('liqvape_cart', JSON.stringify(cart));
  }, [cart]);

  // Загрузка заказов
  const loadUserOrders = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Ошибка загрузки заказов:', error);
    else setUserOrders(data || []);
  }, [userId]);

  useEffect(() => {
    if (userId && ageVerified) loadUserOrders();
  }, [userId, ageVerified, loadUserOrders]);

  // Уведомления с вибрацией
  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'error') window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      else window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => {
      setNotificationVisible(false);
      setTimeout(() => setNotification(null), 300);
    }, 2500);
  };

  const getCartQuantity = (productId: number, flavor: string) => {
    const item = cart.find(i => i.productId === productId && i.flavor === flavor);
    return item ? item.quantity : 0;
  };

  const getAvailableStock = useCallback((productId: number, flavor: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const flavorData = product.flavors.find(f => f.name === flavor);
    if (!flavorData) return 0;
    const inCart = getCartQuantity(productId, flavor);
    return Math.max(0, flavorData.stock - inCart);
  }, [products, cart]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Все' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    const firstAvailable = product.flavors.find((f) => getAvailableStock(product.id, f.name) > 0);
    setSelectedFlavor(firstAvailable?.name || '');
    setQuantity(1);
    setShowAllFlavors(false);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setSelectedFlavor('');
    setQuantity(1);
    setShowAllFlavors(false);
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedFlavor) return;
    const availableStock = getAvailableStock(selectedProduct.id, selectedFlavor);
    
    if (availableStock <= 0) {
      showNotification('Этого товара нет в наличии', 'error');
      return;
    }
    
    if (quantity > availableStock) {
      showNotification(`Максимум можно добавить: ${availableStock} шт.`, 'error');
      setQuantity(availableStock);
      return;
    }
    
    const existingItemIndex = cart.findIndex(
      item => item.productId === selectedProduct.id && item.flavor === selectedFlavor
    );
    
    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += quantity;
      setCart(newCart);
    } else {
      setCart([...cart, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        flavor: selectedFlavor,
        price: selectedProduct.price,
        quantity: quantity,
        image: selectedProduct.image
      }]);
    }
    
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    showNotification(`Добавлено: ${selectedProduct.name} (${selectedFlavor}) × ${quantity}`);
    closeProductModal();
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartQuantity = (index: number, delta: number) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    const flavorData = product.flavors.find(f => f.name === item.flavor);
    if (!flavorData) return;
    const newQuantity = item.quantity + delta;
    
    if (newQuantity > flavorData.stock) {
      showNotification(`В наличии только ${flavorData.stock} шт.`, 'error');
      return;
    }
    
    if (newQuantity <= 0) setCart(cart.filter((_, i) => i !== index));
    else {
      const newCart = [...cart];
      newCart[index].quantity = newQuantity;
      setCart(newCart);
    }
  };

  const clearCart = () => {
    if (confirm('Очистить корзину?')) {
      setCart([]);
      showNotification('Корзина очищена');
    }
  };

  const checkout = async () => {
    if (cart.length === 0 || !userId) return;
    setIsCheckingOut(true);
    
    try {
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        const flavorData = product.flavors.find(f => f.name === item.flavor);
        if (!flavorData || flavorData.stock < item.quantity) {
          showNotification(`Недостаточно: ${item.productName} (${item.flavor})`, 'error');
          setIsCheckingOut(false);
          return;
        }
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayOrders, error: countError } = await supabase
        .from('orders')
        .select('order_number')
        .eq('order_date', today)
        .order('order_number', { ascending: false })
        .limit(1);
      
      if (countError) {
        showNotification('Ошибка при оформлении заказа', 'error');
        setIsCheckingOut(false);
        return;
      }
      
      const nextOrderNumber = todayOrders && todayOrders.length > 0 
        ? todayOrders[0].order_number + 1 : 1;
      
      const { error: insertError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          order_number: nextOrderNumber,
          order_date: today,
          items: cart,
          total_price: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        });
      
      if (insertError) {
        showNotification('Ошибка при сохранении заказа', 'error');
        setIsCheckingOut(false);
        return;
      }
      
      const updatedProducts = products.map(product => {
        const cartItemsForProduct = cart.filter(item => item.productId === product.id);
        if (cartItemsForProduct.length === 0) return product;
        const updatedFlavors = product.flavors.map(flavor => {
          const cartItem = cartItemsForProduct.find(item => item.flavor === flavor.name);
          if (cartItem) return { ...flavor, stock: Math.max(0, flavor.stock - cartItem.quantity) };
          return flavor;
        });
        return { ...product, flavors: updatedFlavors };
      });
      
      setProducts(updatedProducts);
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      // Отправка в Telegram бота
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const orderMessage = `Заказ №${nextOrderNumber}\n${cart.map(item => `${item.productName} (${item.flavor}) × ${item.quantity}`).join('\n')}\nИтого: ${total} BYN`;
        window.Telegram.WebApp.sendData(orderMessage);
      }
      
      showNotification(`Заказ №${nextOrderNumber} оформлен на ${total} BYN!`);
      setCart([]);
      setShowCart(false);
      await loadUserOrders();
      
    } catch (error) {
      console.error('Ошибка оформления заказа:', error);
      showNotification('Произошла ошибка', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const sortedFlavors = useMemo(() => {
    if (!selectedProduct) return [];
    return [...selectedProduct.flavors].sort((a, b) => {
      const aAvailable = getAvailableStock(selectedProduct.id, a.name);
      const bAvailable = getAvailableStock(selectedProduct.id, b.name);
      if (aAvailable > 0 && bAvailable === 0) return -1;
      if (aAvailable === 0 && bAvailable > 0) return 1;
      return 0;
    });
  }, [selectedProduct, getAvailableStock]);

  const visibleFlavors = showAllFlavors ? sortedFlavors : sortedFlavors.slice(0, 5);
  const hiddenFlavorsCount = sortedFlavors.length - 5;
  const availableStock = selectedProduct && selectedFlavor ? getAvailableStock(selectedProduct.id, selectedFlavor) : 0;
  const isFlavorAvailable = availableStock > 0;
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Экран загрузки
  if (ageVerified === null) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-gray-500">Загрузка...</div></div>;
  }

  // Экран отказа
  if (ageDeclined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed top-20 right-10 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-20 left-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="w-full max-w-sm glass-panel p-8 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Доступ запрещён</h1>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Данный сайт содержит информацию, не рекомендованную для лиц младше 18 лет.
          </p>
          <button
            onClick={() => { localStorage.removeItem('liqvape_age_verified'); setAgeVerified(null); setAgeDeclined(false); }}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-colors"
          >
            Пройти проверку снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative">
      {/* Уведомление */}
      {notification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className={`w-full max-w-[280px] rounded-2xl p-4 backdrop-blur-2xl border shadow-2xl transition-all duration-300 ${
            notificationVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
          } ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${notification.type === 'error' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>
                {notification.type === 'error' ? <AlertCircle className="w-6 h-6 text-red-300" /> : <CheckCircle className="w-6 h-6 text-green-300" />}
              </div>
              <p className={`text-sm font-medium ${notification.type === 'error' ? 'text-red-100' : 'text-green-100'}`}>{notification.message}</p>
              <div className="w-full h-0.5 rounded-full bg-white/10 mt-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-[2500ms] ease-linear ${notification.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: notificationVisible ? '0%' : '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-black/80 backdrop-blur-xl border-b border-white/5 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow">
              <Cloud className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-white">Liq</span>
                <span className="gradient-text">Vape</span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">premium shop</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowHistory(true)} className="relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <Clock className="w-5 h-5 text-gray-400" />
                {userOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-xs font-bold flex items-center justify-center text-white">
                    {userOrders.length}
                  </span>
                )}
              </button>
              <button onClick={() => setShowCart(true)} className="relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <ShoppingBag className="w-5 h-5 text-gray-400" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-xs font-bold flex items-center justify-center text-white">
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4">
          {/* Поиск */}
          <div className="relative mb-6 animate-slide-in">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-4 pl-12 pr-4 text-white placeholder-gray-500 transition-all"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Категории */}
          <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-custom animate-slide-in">
            {CATEGORIES.map((category, index) => (
              <button key={category} onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  selectedCategory === category ? 'glass-button-active text-white shadow-lg' : 'glass-button text-gray-400 hover:text-white'
                }`} style={{ animationDelay: `${index * 0.05}s` }}>
                {category}
              </button>
            ))}
          </div>

          {/* Счётчик */}
          <div className="mb-6 flex items-center justify-between animate-fade-in">
            <div className="text-sm text-gray-500">
              Найдено: <span className="text-orange-500 font-bold">{filteredProducts.length}</span> товаров
            </div>
            {selectedCategory !== 'Все' && (
              <button onClick={() => setSelectedCategory('Все')} className="text-xs text-orange-500 hover:text-orange-400 transition-colors">
                Сбросить фильтр
              </button>
            )}
          </div>

          {/* Товары */}
          {filteredProducts.length === 0 ? (
            <div className="glass-panel p-12 text-center animate-fade-in">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-gray-500 text-lg">Товары не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-8">
              {filteredProducts.map((product, index) => {
                const totalStock = product.flavors.reduce((sum, f) => sum + f.stock, 0);
                const inCart = product.flavors.reduce((sum, f) => sum + getCartQuantity(product.id, f.name), 0);
                const available = totalStock - inCart;
                return (
                  <div key={product.id} onClick={() => available > 0 && openProductModal(product)}
                    className={`glass-card p-4 cursor-pointer group animate-fade-in ${available === 0 ? 'opacity-50' : ''}`}
                    style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className="w-full h-36 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-3 flex items-center justify-center group-hover:from-orange-500/10 group-hover:to-pink-500/10 transition-all duration-300 relative">
                      <Package className="w-10 h-10 text-neutral-700 group-hover:text-orange-500 transition-colors" />
                      {available === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                          <span className="text-red-400 font-bold text-sm">Нет в наличии</span>
                        </div>
                      )}
                      {available > 0 && available <= 3 && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30">
                          <span className="text-xs text-orange-400 font-medium">Осталось {available}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-white group-hover:text-orange-400 transition-colors">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold gradient-text">{product.price} BYN</span>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{product.category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Проверка возраста */}
      {ageVerified === false && !ageDeclined && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-sm glass-panel p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow">
              <span className="text-4xl font-bold text-white">18+</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Подтверждение возраста</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Данный сайт содержит информацию о никотиносодержащей продукции. Подтвердите что вам исполнилось 18 лет.
            </p>
            <div className="space-y-3">
              <button onClick={() => confirmAge(true)}
                className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/30">
                <ShieldCheck className="w-5 h-5" /> Мне есть 18 лет
              </button>
              <button onClick={() => confirmAge(false)}
                className="w-full py-4 rounded-2xl font-bold bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center gap-2 transition-colors">
                <ShieldAlert className="w-5 h-5" /> Мне нет 18 лет
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка товара */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeProductModal}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-in">
            <button onClick={closeProductModal} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors z-10">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="p-6">
              {selectedProduct.image ? (
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-48 object-cover rounded-2xl mb-4" />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center">
                  <Package className="w-16 h-16 text-neutral-700" />
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">{selectedProduct.name}</h2>
              <p className="text-3xl font-bold gradient-text mb-6">{selectedProduct.price} BYN</p>

              {selectedProduct.flavors && selectedProduct.flavors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400 font-medium">ВЫБЕРИТЕ ВКУС:</p>
                    <p className="text-xs text-gray-500">
                      {selectedProduct.flavors.filter((f) => getAvailableStock(selectedProduct.id, f.name) > 0).length} доступно
                    </p>
                  </div>
                  <div className="space-y-2">
                    {visibleFlavors?.map((flavor, idx) => {
                      const available = getAvailableStock(selectedProduct.id, flavor.name);
                      const inCart = getCartQuantity(selectedProduct.id, flavor.name);
                      return (
                        <label key={idx} className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                          selectedFlavor === flavor.name ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                        } ${available === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <div className="flex items-center gap-3">
                            <input type="radio" name="flavor" value={flavor.name} checked={selectedFlavor === flavor.name}
                              onChange={() => available > 0 && setSelectedFlavor(flavor.name)} className="w-4 h-4 accent-orange-500" disabled={available === 0} />
                            <div>
                              <span className="text-sm">{flavor.name}</span>
                              {inCart > 0 && <span className="ml-2 text-xs text-orange-400">({inCart} в корзине)</span>}
                            </div>
                          </div>
                          <span className={`text-xs font-medium ${available > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {available > 0 ? `${available} шт.` : 'Нет'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {hiddenFlavorsCount > 0 && !showAllFlavors && (
                    <button onClick={() => setShowAllFlavors(true)} className="w-full mt-3 py-3 rounded-xl border border-orange-500/30 text-orange-400 text-sm hover:bg-orange-500/10 transition-colors">
                      ↓ Показать ещё {hiddenFlavorsCount}
                    </button>
                  )}
                  {showAllFlavors && hiddenFlavorsCount > 0 && (
                    <button onClick={() => setShowAllFlavors(false)} className="w-full mt-3 py-3 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors">
                      ↑ Свернуть
                    </button>
                  )}
                </div>
              )}

              {isFlavorAvailable ? (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between glass-card p-4">
                      <span className="text-sm font-medium">Количество:</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                        <button onClick={() => {
                          if (quantity + 1 > availableStock) showNotification(`Максимум: ${availableStock} шт.`, 'error');
                          else setQuantity(quantity + 1);
                        }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={addToCart} className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/30">
                    <ShoppingBag className="w-5 h-5" /> В корзину • {selectedProduct.price * quantity} BYN
                  </button>
                </>
              ) : (
                <div className="w-full py-4 rounded-2xl font-bold bg-white/5 text-center text-red-400">Товара нет в наличии</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Корзина */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCart(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-in">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Корзина</h2>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300 transition-colors">Очистить</button>
                )}
                <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                  <p className="text-gray-500 text-lg">Корзина пуста</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cart.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      const flavorData = product?.flavors.find(f => f.name === item.flavor);
                      const maxStock = flavorData?.stock || 0;
                      const isMaxReached = item.quantity >= maxStock;
                      return (
                        <div key={index} className="glass-card p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1">{item.productName}</h3>
                              <p className="text-xs text-gray-400">{item.flavor}</p>
                            </div>
                            <button onClick={() => removeFromCart(index)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateCartQuantity(index, -1)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(index, 1)} disabled={isMaxReached}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMaxReached ? 'bg-white/5 opacity-30 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'}`}>
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-lg font-bold gradient-text">{item.price * item.quantity} BYN</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400">Итого:</span>
                      <span className="text-2xl font-bold gradient-text">{totalCartPrice} BYN</span>
                    </div>
                    <button onClick={checkout} disabled={isCheckingOut}
                      className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isCheckingOut ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Оформление...</>
                      ) : (
                        <><ShoppingBag className="w-5 h-5" />Оформить заказ</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* История заказов */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-in">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">История заказов</h2>
              <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              {userOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                  <p className="text-gray-500 text-lg">Заказов пока нет</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userOrders.map((order) => (
                    <div key={order.id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">Заказ №{order.order_number}</h3>
                          <p className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleString('ru-RU', {
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className="text-xl font-bold gradient-text">{order.total_price} BYN</span>
                      </div>
                      <div className="border-t border-white/10 pt-3 space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-300">{item.productName} ({item.flavor})</span>
                            <span className="text-gray-400">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}