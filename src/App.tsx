import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  getDoc,
  setDoc,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Registry, RegistryItem, UserProfile, OperationType } from './types';
import { handleFirestoreError } from './utils';
import { 
  Plus, 
  Gift, 
  Baby, 
  Calendar, 
  ExternalLink, 
  CheckCircle, 
  Trash2, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  Heart,
  Package,
  Info,
  Pencil,
  Share2,
  Copy,
  Check,
  Settings,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
      secondary: 'bg-stone-800 text-white hover:bg-stone-900',
      outline: 'border border-stone-200 bg-transparent hover:bg-stone-50 text-stone-700',
      ghost: 'bg-transparent hover:bg-stone-100 text-stone-600',
      danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [selectedRegistry, setSelectedRegistry] = useState<Registry | null>(null);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RegistryItem | null>(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'price'>('date');
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user profile exists in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Anonymous',
              photoURL: currentUser.photoURL || '',
              role: 'parent'
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          } else {
            setUserProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

    // Fetch Registries
    useEffect(() => {
      if (!isAuthReady) return;

      // If logged in, fetch only owner's registries. 
      // If not logged in, don't fetch anything (public view is handled by deep link)
      if (!user) {
        setRegistries([]);
        return;
      }

      const q = query(collection(db, 'registries'), where('ownerId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
      const registryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registry));
      setRegistries(registryData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registries');
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // Fetch Items for Selected Registry
  useEffect(() => {
    if (!selectedRegistry) {
      setItems([]);
      return;
    }

    const q = query(collection(db, 'items'), where('registryId', '==', selectedRegistry.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegistryItem));
      setItems(itemData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `items (registryId: ${selectedRegistry.id})`);
    });

    return () => unsubscribe();
  }, [selectedRegistry]);

  // Handle Deep Linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const registryId = params.get('registryId');
    
    if (registryId && !selectedRegistry) {
      const fetchRegistry = async () => {
        try {
          const registryDoc = await getDoc(doc(db, 'registries', registryId));
          if (registryDoc.exists()) {
            setSelectedRegistry({ id: registryDoc.id, ...registryDoc.data() } as Registry);
          }
        } catch (error) {
          console.error('Error fetching registry from URL:', error);
        }
      };
      fetchRegistry();
    }
  }, [isAuthReady]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed or cancelled.');
      } else {
        console.error('Login failed:', error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const fetchItemMetadata = async (url: string) => {
    if (!url) return [];
    setIsFetchingMetadata(true);
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.images || [];
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setIsFetchingMetadata(false);
    }
    return [];
  };

  const getCurrencySymbol = (code?: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || '$';
  };

  const createRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const babyName = formData.get('babyName') as string;
    const dueDate = formData.get('dueDate') as string;
    const description = formData.get('description') as string;
    const currency = formData.get('currency') as string;

    try {
      await addDoc(collection(db, 'registries'), {
        babyName,
        dueDate,
        description,
        currency,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsCreateModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'registries');
    }
  };

  const updateRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedRegistry) return;

    const formData = new FormData(e.currentTarget);
    const babyName = formData.get('babyName') as string;
    const dueDate = formData.get('dueDate') as string;
    const description = formData.get('description') as string;
    const currency = formData.get('currency') as string;

    try {
      const registryRef = doc(db, 'registries', selectedRegistry.id);
      await updateDoc(registryRef, {
        babyName,
        dueDate,
        description,
        currency
      });
      setSelectedRegistry({
        ...selectedRegistry,
        babyName,
        dueDate,
        description,
        currency
      });
      setIsSettingsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `registries/${selectedRegistry.id}`);
    }
  };

  const addItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedRegistry) return;

    const formData = new FormData(e.currentTarget);
    const priceVal = formData.get('price');
    const price = (priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
    const url = (formData.get('url') as string) || "";
    const description = (formData.get('description') as string) || "";

    setIsSubmittingItem(true);
    try {
      await addDoc(collection(db, 'items'), {
        registryId: selectedRegistry.id,
        name: formData.get('name') as string,
        description,
        price,
        quantity: Math.floor(Number(formData.get('quantity'))) || 1,
        url,
        imageUrl: selectedImageUrl || null,
        category: formData.get('category') as string,
        status: 'available',
        addedBy: user.uid,
        createdAt: serverTimestamp()
      });
      setIsAddItemModalOpen(false);
      setFetchedImages([]);
      setSelectedImageUrl(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const editItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingItem) return;

    const formData = new FormData(e.currentTarget);
    const priceVal = formData.get('price');
    const price = (priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
    const url = formData.get('url') as string;

    setIsSubmittingItem(true);
    try {
      const itemRef = doc(db, 'items', editingItem.id);
      const updateData: any = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        price,
        quantity: Number(formData.get('quantity')) || 1,
        url,
        imageUrl: selectedImageUrl || null,
        category: formData.get('category') as string,
      };

      if (!editingItem.createdAt) {
        updateData.createdAt = serverTimestamp();
      }

      await updateDoc(itemRef, updateData);
      setIsEditItemModalOpen(false);
      setEditingItem(null);
      setFetchedImages([]);
      setSelectedImageUrl(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${editingItem.id}`);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const claimItem = async (item: RegistryItem) => {
    if (!user) {
      alert('Please sign in to claim an item!');
      return;
    }

    try {
      const itemRef = doc(db, 'items', item.id);
      await updateDoc(itemRef, {
        status: 'claimed',
        claimedBy: user.uid,
        claimedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${item.id}`);
    }
  };

  const reserveItem = async (item: RegistryItem) => {
    if (!user) {
      alert('Please sign in to reserve an item!');
      return;
    }

    try {
      const itemRef = doc(db, 'items', item.id);
      await updateDoc(itemRef, {
        status: 'reserved',
        claimedBy: user.uid,
        claimedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${item.id}`);
    }
  };

  const unclaimItem = async (item: RegistryItem) => {
    if (!user || item.claimedBy !== user.uid) return;

    try {
      const itemRef = doc(db, 'items', item.id);
      await updateDoc(itemRef, {
        status: 'available',
        claimedBy: null,
        claimedAt: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${item.id}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to remove this item?')) return;
    try {
      await deleteDoc(doc(db, 'items', itemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${itemId}`);
    }
  };

  const handleShare = () => {
    if (!selectedRegistry) return;
    const origin = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const url = `${origin}${window.location.pathname}?registryId=${selectedRegistry.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-emerald-600"
        >
          <Baby className="w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => setSelectedRegistry(null)}
            >
              <div className="bg-emerald-100 p-2 rounded-xl">
                <Baby className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="font-bold text-xl tracking-tight text-stone-800">Little Steps</span>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-stone-900">{user.displayName}</p>
                    <p className="text-xs text-stone-500">{user.email}</p>
                  </div>
                  <img 
                    src={user.photoURL || ''} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <Button variant="ghost" onClick={handleLogout} className="p-2">
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLogin} disabled={isLoggingIn}>
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedRegistry ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Hero */}
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 mb-4 tracking-tight">
                Welcome to Little Steps Registry
              </h1>
              <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                Create a beautiful gift registry for your little one and share it with friends and family.
              </p>
              {user && (
                <div className="mt-8">
                  <Button onClick={() => setIsCreateModalOpen(true)} className="px-8 py-3 text-base">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your Registry
                  </Button>
                </div>
              )}
            </div>

            {/* Registries List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {registries.map((registry) => (
                <motion.div
                  key={registry.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedRegistry(registry)}
                  className="cursor-pointer"
                >
                  <Card className="h-full hover:border-emerald-200 transition-colors">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-stone-50 p-3 rounded-2xl">
                          <Gift className="w-6 h-6 text-stone-400" />
                        </div>
                        {user?.uid === registry.ownerId && (
                          <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-lg">
                            Your Registry
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-stone-900 mb-2">{registry.babyName}'s Registry</h3>
                      <p className="text-stone-500 text-sm line-clamp-2 mb-4">
                        {registry.description || 'No description provided.'}
                      </p>
                      <div className="flex items-center text-stone-400 text-sm gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {registry.dueDate || 'TBD'}</span>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-between items-center">
                      <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">View Registry</span>
                      <ChevronRight className="w-4 h-4 text-stone-300" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {registries.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                <Package className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400">No registries found yet. Be the first to create one!</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Registry Detail View */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <button 
                  onClick={() => setSelectedRegistry(null)}
                  className="text-stone-400 hover:text-stone-600 mb-4 flex items-center gap-1 text-sm font-medium transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back to all registries
                </button>
                <h2 className="text-3xl font-bold text-stone-900">{selectedRegistry.babyName}'s Registry</h2>
                <p className="text-stone-500 mt-1">{selectedRegistry.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleShare} title="Share Registry">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {user?.uid === selectedRegistry.ownerId && (
                  <>
                    <Button variant="outline" onClick={() => setIsSettingsModalOpen(true)} title="Registry Settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                    <Button onClick={() => setIsAddItemModalOpen(true)}>
                      <Plus className="w-5 h-5 mr-2" />
                      Add Item
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Filter and Sort */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {['All', 'Gear', 'Clothing', 'Feeding', 'Nursery', 'Toys', 'Other'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      filterCategory === cat 
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                        : "bg-white text-stone-600 border border-stone-100 hover:bg-stone-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-stone-100 shadow-sm">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-2 mr-1">Sort:</span>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-stone-600 outline-none pr-2 py-1 cursor-pointer"
                >
                  <option value="date">Date Added</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                </select>
              </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items
                .filter(item => filterCategory === 'All' || item.category === filterCategory)
                .sort((a, b) => {
                  if (sortBy === 'name') return a.name.localeCompare(b.name);
                  if (sortBy === 'price') return (a.price || 0) - (b.price || 0);
                  // Default to date added (newest first)
                  const dateA = a.createdAt?.seconds || 0;
                  const dateB = b.createdAt?.seconds || 0;
                  return dateB - dateA;
                })
                .map((item) => (
                <motion.div key={item.id} layout>
                  <Card className={cn(
                    'h-full flex flex-col transition-all',
                    item.status === 'claimed' ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-md'
                  )}>
                    {item.imageUrl && (
                      <div className="aspect-square w-full overflow-hidden bg-stone-100 border-b border-stone-50">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          {item.category || 'General'}
                        </span>
                        {user?.uid === selectedRegistry.ownerId && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setEditingItem(item);
                                setSelectedImageUrl(item.imageUrl || null);
                                setIsEditItemModalOpen(true);
                              }}
                              className="text-stone-300 hover:text-emerald-600 transition-colors"
                              title="Edit Item"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteItem(item.id)}
                              className="text-stone-300 hover:text-rose-500 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <h4 className="font-bold text-stone-900 text-lg mb-1">{item.name}</h4>
                      <p className="text-stone-500 text-sm mb-2 line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                          Qty: {item.quantity || 1}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto">
                        {item.price != null ? (
                          <span className="text-xl font-bold text-stone-900">
                            {getCurrencySymbol(selectedRegistry.currency)}{item.price}
                          </span>
                        ) : (
                          <div />
                        )}
                        {item.url && (
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-stone-400 hover:text-emerald-600 transition-colors"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-4 bg-stone-50 border-t border-stone-100">
                      {item.status === 'claimed' ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            <span>Claimed</span>
                          </div>
                          {user?.uid === item.claimedBy && (
                            <Button variant="ghost" onClick={() => unclaimItem(item)} className="text-xs h-8 px-2">
                              Unclaim
                            </Button>
                          )}
                        </div>
                      ) : item.status === 'reserved' ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold">
                            <Clock className="w-4 h-4" />
                            <span>Reserved</span>
                          </div>
                          {user?.uid === item.claimedBy && (
                            <Button variant="ghost" onClick={() => unclaimItem(item)} className="text-xs h-8 px-2">
                              Unreserve
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button 
                            className="flex-1" 
                            variant="outline"
                            onClick={() => claimItem(item)}
                            disabled={!user}
                            title={!user ? "Sign in to claim this item" : ""}
                          >
                            <Heart className="w-4 h-4 mr-2" />
                            {user ? 'Claim' : 'Sign in'}
                          </Button>
                          <Button 
                            className="flex-1" 
                            variant="ghost"
                            onClick={() => reserveItem(item)}
                            disabled={!user}
                            title={!user ? "Sign in to reserve this item" : ""}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            {user ? 'Reserve' : 'Sign in'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                <Package className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400">No items added to this registry yet.</p>
              </div>
            ) : items.filter(item => filterCategory === 'All' || item.category === filterCategory).length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                <Package className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400">No items found in the "{filterCategory}" category.</p>
                <Button variant="ghost" onClick={() => setFilterCategory('All')} className="mt-4">
                  Clear Filter
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Registry"
      >
        <form onSubmit={createRegistry} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Baby's Name</label>
            <input 
              name="babyName" 
              required 
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="e.g. Baby Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Due Date (Optional)</label>
            <input 
              name="dueDate" 
              type="date"
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={3}
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="A little bit about your registry..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Currency</label>
            <select 
              name="currency"
              defaultValue="USD"
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full py-3">Create Registry</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isAddItemModalOpen} 
        onClose={() => {
          setIsAddItemModalOpen(false);
          setFetchedImages([]);
          setSelectedImageUrl(null);
        }} 
        title="Add Item to Registry"
      >
        <form onSubmit={addItem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Item Name</label>
            <input 
              name="name" 
              required 
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="e.g. Baby Stroller"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Price ({getCurrencySymbol(selectedRegistry?.currency)})</label>
              <input 
                name="price" 
                type="number"
                step="0.01"
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
              <input 
                name="quantity" 
                type="number"
                min="1"
                defaultValue="1"
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
            <select 
              name="category"
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
            >
                <option value="Gear">Gear</option>
                <option value="Clothing">Clothing</option>
                <option value="Feeding">Feeding</option>
                <option value="Nursery">Nursery</option>
                <option value="Toys">Toys</option>
                <option value="Other">Other</option>
              </select>
            </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Link (URL)</label>
            <div className="flex gap-2">
              <input 
                name="url" 
                id="addItemUrl"
                type="url"
                className="flex-1 rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="https://..."
              />
              <Button 
                type="button" 
                variant="secondary"
                onClick={async () => {
                  const urlInput = document.getElementById('addItemUrl') as HTMLInputElement;
                  if (urlInput?.value) {
                    const images = await fetchItemMetadata(urlInput.value);
                    setFetchedImages(images);
                    if (images.length > 0) setSelectedImageUrl(images[0]);
                  }
                }}
                disabled={isFetchingMetadata}
              >
                {isFetchingMetadata ? '...' : 'Fetch'}
              </Button>
            </div>
          </div>

          {fetchedImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Choose Image</label>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {fetchedImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageUrl(img)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      selectedImageUrl === img ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt={`Option ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {selectedImageUrl === img && (
                      <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                        <div className="bg-emerald-500 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
                {/* Option to clear image */}
                <button
                  type="button"
                  onClick={() => setSelectedImageUrl(null)}
                  className={cn(
                    "relative flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-400 transition-all",
                    selectedImageUrl === null ? "border-emerald-500 text-emerald-500 bg-emerald-50" : ""
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">No Image</span>
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={2}
              className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="Size, color, or other details..."
            />
          </div>
          <Button type="submit" className="w-full py-3" disabled={isSubmittingItem}>
            {isSubmittingItem ? 'Adding Item...' : 'Add to Registry'}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isEditItemModalOpen} 
        onClose={() => {
          setIsEditItemModalOpen(false);
          setEditingItem(null);
          setFetchedImages([]);
          setSelectedImageUrl(null);
        }} 
        title="Edit Item"
      >
        {editingItem && (
          <form onSubmit={editItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Item Name</label>
              <input 
                name="name" 
                required 
                defaultValue={editingItem.name}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="e.g. Baby Stroller"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Price ({getCurrencySymbol(selectedRegistry?.currency)})</label>
                <input 
                  name="price" 
                  type="number"
                  step="0.01"
                  defaultValue={editingItem.price}
                  className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
                <input 
                  name="quantity" 
                  type="number"
                  min="1"
                  defaultValue={editingItem.quantity || 1}
                  className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select 
                name="category"
                defaultValue={editingItem.category}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              >
                  <option value="Gear">Gear</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Feeding">Feeding</option>
                  <option value="Nursery">Nursery</option>
                  <option value="Toys">Toys</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Link (URL)</label>
              <div className="flex gap-2">
                <input 
                  name="url" 
                  id="editItemUrl"
                  type="url"
                  defaultValue={editingItem.url}
                  className="flex-1 rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="https://..."
                />
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={async () => {
                    const urlInput = document.getElementById('editItemUrl') as HTMLInputElement;
                    if (urlInput?.value) {
                      const images = await fetchItemMetadata(urlInput.value);
                      setFetchedImages(images);
                      if (images.length > 0) setSelectedImageUrl(images[0]);
                    }
                  }}
                  disabled={isFetchingMetadata}
                >
                  {isFetchingMetadata ? '...' : 'Fetch'}
                </Button>
              </div>
            </div>

            {(fetchedImages.length > 0 || editingItem.imageUrl) && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Choose Image</label>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {/* Current Image */}
                  {editingItem.imageUrl && !fetchedImages.includes(editingItem.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => setSelectedImageUrl(editingItem.imageUrl || null)}
                      className={cn(
                        "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                        selectedImageUrl === editingItem.imageUrl ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={editingItem.imageUrl} alt="Current" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white py-0.5 text-center">Current</span>
                      {selectedImageUrl === editingItem.imageUrl && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                          <div className="bg-emerald-500 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                    </button>
                  )}
                  {/* Fetched Images */}
                  {fetchedImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageUrl(img)}
                      className={cn(
                        "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                        selectedImageUrl === img ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={img} alt={`Option ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {selectedImageUrl === img && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                          <div className="bg-emerald-500 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                  {/* Option to clear image */}
                  <button
                    type="button"
                    onClick={() => setSelectedImageUrl(null)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-400 transition-all",
                      selectedImageUrl === null ? "border-emerald-500 text-emerald-500 bg-emerald-50" : ""
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase">No Image</span>
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
              <textarea 
                name="description" 
                rows={2}
                defaultValue={editingItem.description}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="Size, color, or other details..."
              />
            </div>
            <Button type="submit" className="w-full py-3" disabled={isSubmittingItem}>
              {isSubmittingItem ? 'Updating Item...' : 'Update Item'}
            </Button>
          </form>
        )}
      </Modal>

      <Modal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
        title="Registry Settings"
      >
        {selectedRegistry && (
          <form onSubmit={updateRegistry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Baby's Name</label>
              <input 
                name="babyName" 
                required 
                defaultValue={selectedRegistry.babyName}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="e.g. Baby Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
              <input 
                name="dueDate" 
                type="date"
                defaultValue={selectedRegistry.dueDate}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
              <textarea 
                name="description" 
                rows={3}
                defaultValue={selectedRegistry.description}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="A little bit about your registry..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Currency</label>
              <select 
                name="currency"
                defaultValue={selectedRegistry.currency || 'USD'}
                className="w-full rounded-xl border-stone-200 focus:border-emerald-500 focus:ring-emerald-500"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full py-3">Save Settings</Button>
          </form>
        )}
      </Modal>

      {/* Share Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-stone-900 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
              <div className="bg-emerald-500 p-1 rounded-full">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">Link copied to clipboard!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-100 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Baby className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-stone-800">Little Steps</span>
          </div>
          <p className="text-stone-400 text-sm">© 2026 Little Steps Registry. Made with love for new parents.</p>
        </div>
      </footer>
    </div>
  );
}
