'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Edit, Send, Settings, HelpCircle, Info, LogIn } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';

// ... (все константы и интерфейсы остаются без изменений) ...

const CATEGORIES = ['Все', 'Жидкости', 'Расходники', 'Снюс', 'POD-системы', 'Одноразки', 'Табак-угли', 'Другое'];
const CATEGORY_PRIORITY: Record<string, number> = {
  'Жидкости': 1, 'Снюс': 2, 'Расходники': 3,
  'POD-системы': 4, 'Одноразки': 5, 'Табак-угли': 6, 'Другое': 7,
};
const LETTER_PRIORITY: Record<string, string[]> = {
  'Жидкости': ['R','D','C','A','B','E','P','G','S','F','H'],
  'Снюс': ['D','E','G','F'],
  'Одноразки': ['P','K','E'],
  'Расходники': ['V'],
};

const getLetterPriority = (name: string, category: string): number => {
  if (category === 'Расходники' && name.toUpperCase().startsWith('VAPORESSO')) return -1;
  const firstLetter = name.charAt(0).toUpperCase();
  const priorities = LETTER_PRIORITY[category];
  if (!priorities) return 999;
  const idx = priorities.indexOf(firstLetter);
  return idx === -1 ? 999 : idx;
};

const ADMIN_PASSWORD = 'K7m2Q9';
const MANAGER_USERNAME = 'LiqVape_2';
const CHANNEL_USERNAME = 'zslvape';
const CHANNEL_LINK = 'https://t.me/' + CHANNEL_USERNAME;

interface Variant { name: string; stock: number; price?: number; }
interface Product {
  id: string; name: string; category: string; price: number; image: string | null;
  variants: Variant[]; is_hidden: boolean; is_preorder: boolean; created_at?: string;
}
interface ListItem { productId: string; productName: string; variant: string; price: number; quantity: number; isPreorder: boolean; }

// Оптимизированное сжатие для Telegram
const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 250; // Ещё меньше для Telegram
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/webp', 0.5); // Качество 0.5
      resolve(base64);
    };
  });
};

const BATCH_SIZE = 12;

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<{ name: string; quantity: number }[]>([]);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [selectionList, setSelectionList] = useState<ListItem[]>([]);
  const [showList, setShowList] = useState(false);
  const [userId, setUserId] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'requests'>('products');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('Все');
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> & { id?: string } | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showFirstTimeTutorial, setShowFirstTimeTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE);
  const [isTelegram, setIsTelegram] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Определяем, что это Telegram Mini App
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
      setIsTelegram(true);
      
      const platform = (window as any).Telegram.WebApp.platform || '';
      const isDesktop = platform.toLowerCase().includes('tdesktop') || platform.toLowerCase().includes('macos');
      if (!isDesktop) (window as any).Telegram.WebApp.expand();
      
      // Настраиваем цвета под тему Telegram
      const tg = (window as any).Telegram.WebApp;
      tg.setHeaderColor(tg.themeParams.bg_color || '#000000');
      tg.setBackgroundColor(tg.themeParams.bg_color || '#000000');
    }
  }, []);

  useEffect(() => {
    const hasSeen = localStorage.getItem('liqvape_seen_subscribe');
    if (!hasSeen) { setShowSubscribePrompt(true); localStorage.setItem('liqvape_seen_subscribe', 'true'); }
    const firstTime = localStorage.getItem('liqvape_first_time');
    if (!firstTime) { setShowFirstTimeTutorial(true); localStorage.setItem('liqvape_first_time', 'true'); }
  }, []);

  useEffect(() => {
    let id = localStorage.getItem('liqvape_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('liqvape_user_id', id); }
    setUserId(id);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('liqvape_admin_session');
    if (session === 'true') { setIsAdmin(true); setShowAdminPanel(true); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('liqvape_selection_list');
    if (saved) { try { setSelectionList(JSON.parse(saved)); } catch(e) {} }
  }, []);
  useEffect(() => { localStorage.setItem('liqvape_selection_list', JSON.stringify(selectionList)); }, [selectionList]);

  //  ОПТИМИЗИРОВАННАЯ ЗАГРУЗКА ДЛЯ TELEGRAM
  const loadProducts = useCallback(async (includeHidden = false): Promise<Product[]> => {
    try {
      console.log('🔄 Loading products...');
      const startTime = Date.now();
      
      const q = query(collection(db, 'products'));
      const snapshot = await getDocs(q);
      
      const parsed: Product[] = [];
      snapshot.forEach((docSnapshot) => {
        const p = docSnapshot.data();
        if (!includeHidden && p.is_hidden) return;
        
        const pAny = p as any;
        let priceValue = 0;
        if (pAny.price && typeof pAny.price === 'object') {
          priceValue = Number(pAny.price.doubleValue ?? pAny.price.integerValue ?? 0);
        } else {
          priceValue = Number(pAny.price) || 0;
        }
        
        const variants = (pAny.flavors || []).map((v: any) => {
          let variantPrice = priceValue;
          if (v.price !== undefined && v.price !== null) {
            if (typeof v.price === 'object' && v.price !== null) {
              variantPrice = Number(v.price.doubleValue ?? v.price.integerValue ?? priceValue);
            } else {
              variantPrice = Number(v.price) || priceValue;
            }
          }
          return {
            name: String(v.name || ''),
            stock: Number(v.stock) || 0,
            price: variantPrice
          };
        });
        
        parsed.push({
          id: docSnapshot.id, 
          name: p.name, 
          category: p.category || 'Другое',
          price: priceValue, 
          image: p.image_url || null,
          variants: variants,
          is_hidden: Boolean(p.is_hidden), 
          is_preorder: Boolean(p.is_preorder),
          created_at: pAny.created_at || new Date().toISOString()
        });
      });
      
      // Сортировка
      parsed.sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });
      
      setProducts(parsed);
      setIsLoading(false);
      setDisplayCount(BATCH_SIZE);
      
      // КЭШИРОВАНИЕ (для Telegram - только metadata, без картинок)
      if (!isTelegram) {
        // В браузере кэшируем с картинками
        const cacheKey = includeHidden ? 'liqvape_products_admin' : 'liqvape_products';
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
        localStorage.setItem(cacheKey + '_time', Date.now().toString());
      } else {
        // В Telegram кэшируем БЕЗ картинок (только metadata)
        const cacheKey = includeHidden ? 'liqvape_products_admin' : 'liqvape_products';
        const lightCache = parsed.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          variants: p.variants,
          is_hidden: p.is_hidden,
          is_preorder: p.is_preorder,
          created_at: p.created_at
          // image: null - не кэшируем!
        }));
        try {
          localStorage.setItem(cacheKey, JSON.stringify(lightCache));
          localStorage.setItem(cacheKey + '_time', Date.now().toString());
        } catch(e) {
          console.warn('LocalStorage quota exceeded in Telegram');
        }
      }
      
      console.log('✅ Loaded', parsed.length, 'products in', Date.now() - startTime, 'ms');
      return parsed;
      
    } catch(e) {
      console.error(' Load error:', e);
      setIsLoading(false);
      return [];
    }
  }, [isTelegram]);

  const loadAllRequests = useCallback(async () => {
    try {
      const q = query(collection(db, 'user_requests'));
      const snapshot = await getDocs(q);
      const requests: any[] = [];
      snapshot.forEach((docSnapshot) => {
        requests.push({ id: docSnapshot.id, ...docSnapshot.data() });
      });
      requests.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setAllRequests(requests);
    } catch(e) {
      console.error('Load requests error:', e);
    }
  }, [isTelegram]);

  useEffect(() => {
    loadProducts(isAdmin);
    if (isAdmin) loadAllRequests();
  }, [isAdmin, loadProducts, loadAllRequests]);

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getAvailableStock = (productId: string, variant: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const v = product.variants.find(x => x.name === variant);
    if (!v) return 0;
    return v.stock;
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === 'Все' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aAvail = a.variants.reduce((s, v) => s + v.stock, 0);
      const bAvail = b.variants.reduce((s, v) => s + v.stock, 0);
      
      const aInStock = aAvail > 0;
      const bInStock = bAvail > 0;
      const aPreorder = a.is_preorder;
      const bPreorder = b.is_preorder;
      
      const getAvailabilityPriority = (inStock: boolean, isPreorder: boolean) => {
        if (inStock) return 1;
        if (isPreorder) return 2;
        return 3;
      };
      
      const aPriority = getAvailabilityPriority(aInStock, aPreorder);
      const bPriority = getAvailabilityPriority(bInStock, bPreorder);
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      if (selectedCategory === 'Все') {
        const aCatOrder = CATEGORY_PRIORITY[a.category] || 99;
        const bCatOrder = CATEGORY_PRIORITY[b.category] || 99;
        if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder;
        const aLetter = getLetterPriority(a.name, a.category);
        const bLetter = getLetterPriority(b.name, b.category);
        if (aLetter !== bLetter) return aLetter - bLetter;
      } else {
        const aLetter = getLetterPriority(a.name, a.category);
        const bLetter = getLetterPriority(b.name, b.category);
        if (aLetter !== bLetter) return aLetter - bLetter;
      }
      return 0;
    });
  }, [filteredProducts, selectedCategory]);

  // Ленивая загрузка
  const visibleProducts = sortedProducts.slice(0, displayCount);
  const hasMore = displayCount < sortedProducts.length;

  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setDisplayCount(prev => Math.min(prev + BATCH_SIZE, sortedProducts.length));
      }
    }, { threshold: 0.1, rootMargin: '100px' });
    
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, sortedProducts.length]);

  // Сброс при фильтрации
  useEffect(() => {
    setDisplayCount(BATCH_SIZE);
  }, [search, selectedCategory]);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariants([]);
    setShowAllVariants(false);
  };

  const toggleVariantSelection = (variantName: string) => {
    setSelectedVariants(prev => {
      const exists = prev.find(v => v.name === variantName);
      if (exists) return prev.filter(v => v.name !== variantName);
      return [...prev, { name: variantName, quantity: 1 }];
    });
  };

  const updateVariantQuantity = (variantName: string, delta: number) => {
    if (!selectedProduct) return;
    setSelectedVariants(prev => prev.map(v => {
      if (v.name !== variantName) return v;
      const avail = getAvailableStock(selectedProduct.id, v.name);
      const newQty = v.quantity + delta;
      if (newQty < 1) return v;
      if (newQty > avail && !selectedProduct.is_preorder) { showNotification('Максимум: ' + avail, 'error'); return v; }
      return { ...v, quantity: newQty };
    }));
  };

  const addSelectedToList = () => {
    if (!selectedProduct || selectedVariants.length === 0) { showNotification('Выберите вкус', 'error'); return; }
    const issues: string[] = [];
    for (const sv of selectedVariants) {
      const avail = getAvailableStock(selectedProduct.id, sv.name);
      if (avail <= 0 && !selectedProduct.is_preorder) issues.push(sv.name + ' — нет в наличии');
      else if (sv.quantity > avail && !selectedProduct.is_preorder) issues.push(sv.name + ' — максимум ' + avail);
    }
    if (issues.length > 0) { showNotification(issues.join('; '), 'error'); return; }
    let newList = [...selectionList];
    for (const sv of selectedVariants) {
      const v = selectedProduct.variants.find(x => x.name === sv.name);
      const price = (v?.price !== undefined && v?.price !== null && v.price > 0) ? v.price : selectedProduct.price;
      const idx = newList.findIndex(i => i.productId === selectedProduct.id && i.variant === sv.name);
      if (idx >= 0) {
        newList[idx] = { ...newList[idx], quantity: newList[idx].quantity + sv.quantity, price };
      } else {
        newList.push({
          productId: selectedProduct.id, productName: selectedProduct.name,
          variant: sv.name, price, quantity: sv.quantity, isPreorder: selectedProduct.is_preorder
        });
      }
    }
    setSelectionList(newList);
    showNotification('Добавлено: ' + selectedProduct.name);
    setSelectedProduct(null);
    setSelectedVariants([]);
  };

  const removeFromList = (i: number) => setSelectionList(selectionList.filter((_, x) => x !== i));

  const updateListQuantity = (i: number, d: number) => {
    const item = selectionList[i];
    const p = products.find(x => x.id === item.productId);
    const v = p?.variants.find(x => x.name === item.variant);
    const nq = item.quantity + d;
    if (v && nq > v.stock && !item.isPreorder) { showNotification('Максимум: ' + v.stock, 'error'); return; }
    if (nq <= 0) setSelectionList(selectionList.filter((_, x) => x !== i));
    else { const nl = [...selectionList]; nl[i].quantity = nq; setSelectionList(nl); }
  };

  const clearList = () => { if (confirm('Очистить?')) { setSelectionList([]); showNotification('Список очищен'); } };

  const sendToManager = async () => {
    if (selectionList.length === 0) return;
    setIsSending(true);
    const totalPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);
    let message = 'Привет! Хочу сделать заказ:\n\n';
    const grouped: Record<string, ListItem[]> = {};
    selectionList.forEach(item => {
      if (!grouped[item.productName]) grouped[item.productName] = [];
      grouped[item.productName].push(item);
    });
    for (const [name, items] of Object.entries(grouped)) {
      message += ` ${name}\n`;
      for (const item of items) {
        const tag = item.isPreorder ? ' [ПРЕДЗАКАЗ]' : '';
        message += `   • ${item.variant} × ${item.quantity}${tag}\n`;
      }
    }
    message += `\n💰 Итого: ${totalPrice.toFixed(2)} BYN`;
    const link = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(message)}`;
    
    if (typeof window !== 'undefined') {
      const platform = (window as any).Telegram?.WebApp?.platform || '';
      const isDesktop = platform.toLowerCase().includes('tdesktop') || platform.toLowerCase().includes('macos') || platform.toLowerCase().includes('web');
      if (isDesktop) {
        window.open(link, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.position = 'fixed';
        a.style.top = '-9999px';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
    
    setSelectionList([]);
    setShowList(false);
    setShowSendConfirm(false);
    showNotification('Переходим в Telegram...', 'success');
    
    try {
      await addDoc(collection(db, 'user_requests'), {
        user_id: userId, 
        username: 'Клиент',
        items: selectionList,
        total_price: totalPrice, 
        status: 'new',
        created_at: new Date().toISOString()
      });
    } catch(e) {
      console.error('Background save failed:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminPassword('');
      localStorage.setItem('liqvape_admin_session', 'true');
      showNotification('Вход выполнен');
    } else { showNotification('Неверный пароль', 'error'); }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    localStorage.removeItem('liqvape_admin_session');
  };

  const openProductForm = (product?: Product) => {
    if (product) {
      setEditingProduct({
        id: product.id, name: product.name, price: product.price,
        category: product.category, image: product.image,
        is_hidden: product.is_hidden, is_preorder: product.is_preorder
      });
      setFormVariants([...product.variants].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })));
    } else {
      setEditingProduct({ name: '', price: 0, category: 'Другое', image: null, is_hidden: false, is_preorder: false });
      setFormVariants([]);
    }
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct.price) { 
      showNotification('Заполните название и цену', 'error'); 
      return; 
    }
    
    const data: any = {
      name: editingProduct.name, 
      price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое', 
      image_url: editingProduct.image || null,
      flavors: formVariants,
      stock_quantity: formVariants.reduce((s, f) => s + (f.stock || 0), 0),
      is_hidden: Boolean(editingProduct.is_hidden), 
      is_preorder: Boolean(editingProduct.is_preorder)
    };
    
    if (!editingProduct.id) {
      data.created_at = new Date().toISOString();
    } else {
      delete data.created_at;
    }
    
    try {
      if (editingProduct.id) {
        const docRef = doc(db, 'products', editingProduct.id);
        await updateDoc(docRef, data);
        showNotification('Товар обновлён', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'products'), data);
        showNotification('Товар добавлен', 'success');
      }
      
      setShowProductForm(false);
      setEditingProduct(null);
      setFormVariants([]);
      await loadProducts(true);
      
    } catch(e) {
      showNotification('Ошибка: ' + (e as Error).message, 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showNotification('Обработка фото...');
    try {
      const base64 = await compressAndConvertToBase64(file);
      setEditingProduct(prev => prev ? {...prev, image: base64} : null);
      showNotification('Фото готово!', 'success');
    } catch (err) {
      showNotification('Ошибка загрузки фото', 'error');
    }
  };

  const toggleHidden = async (p: Product) => {
    await updateDoc(doc(db, 'products', p.id), { is_hidden: !p.is_hidden });
    await loadProducts(true);
  };

  const togglePreorder = async (p: Product) => {
    await updateDoc(doc(db, 'products', p.id), { is_preorder: !p.is_preorder });
    await loadProducts(true);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Удалить товар?')) return;
    await deleteDoc(doc(db, 'products', id));
    await loadProducts(true);
    showNotification('Товар удалён');
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Заказ обработан? Удалить из списка?')) return;
    await deleteDoc(doc(db, 'user_requests', id));
    await loadAllRequests();
    showNotification('Заказ удален', 'success');
  };

  const sortedVariants = useMemo(() => {
    if (!selectedProduct) return [];
    return [...selectedProduct.variants].sort((a, b) => {
      const aAvail = getAvailableStock(selectedProduct.id, a.name);
      const bAvail = getAvailableStock(selectedProduct.id, b.name);
      const aIsAvailable = aAvail > 0 || selectedProduct.is_preorder;
      const bIsAvailable = bAvail > 0 || selectedProduct.is_preorder;
      if (aIsAvailable && !bIsAvailable) return -1;
      if (!aIsAvailable && bIsAvailable) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [selectedProduct]);

  const visibleVariants = showAllVariants ? sortedVariants : sortedVariants.slice(0, 5);
  const hiddenVariantsCount = sortedVariants.length - 5;
  const totalListItems = selectionList.reduce((s, i) => s + i.quantity, 0);
  const totalListPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);

  const groupedSelectionList = useMemo(() => {
    const grouped: Record<string, ListItem[]> = {};
    selectionList.forEach(item => {
      if (!grouped[item.productName]) grouped[item.productName] = [];
      grouped[item.productName].push(item);
    });
    return Object.entries(grouped);
  }, [selectionList]);

  const filteredAdminProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase());
      const matchCategory = adminCategory === 'Все' || p.category === adminCategory;
      return matchSearch && matchCategory;
    });
  }, [products, adminSearch, adminCategory]);

  // ... (остальной код админки и UI остается без изменений) ...
  // Для краткости я не включаю весь UI код здесь - он остается таким же

  if (showAdminPanel) {
    return <div>Admin Panel</div>; // Заглушка для краткости
  }

  return (
    <div className="min-h-screen text-white relative bg-black">
      {/* ... (весь JSX остается без изменений) ... */}
      <div>Product List with Lazy Loading</div>
    </div>
  );
}
