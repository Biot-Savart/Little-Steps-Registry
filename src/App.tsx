import React, { useState, useEffect, useRef } from 'react';
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
  getDocFromServer,
  arrayUnion,
  arrayRemove,
  or,
  Timestamp
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged, 
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Registry, RegistryItem, UserProfile, OperationType, Notification as AppNotification } from './types';
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
  Clock,
  Ruler,
  Download,
  Bell,
  LayoutGrid,
  List,
  Users,
  X,
  Backpack,
  Shirt,
  Utensils,
  Moon,
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'react-hot-toast';

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
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center shrink-0">
            <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
            <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const CategoryPlaceholder = ({ category, name, className }: { category?: string, name: string, className?: string }) => {
  const getCategoryConfig = (cat?: string) => {
    switch (cat) {
      case 'Gear': return { Icon: Backpack, bg: 'from-blue-50 to-indigo-100', text: 'text-blue-600' };
      case 'Clothing': return { Icon: Shirt, bg: 'from-pink-50 to-rose-100', text: 'text-pink-600' };
      case 'Feeding': return { Icon: Utensils, bg: 'from-orange-50 to-amber-100', text: 'text-orange-600' };
      case 'Nursery': return { Icon: Moon, bg: 'from-purple-50 to-fuchsia-100', text: 'text-purple-600' };
      case 'Toys': return { Icon: Gamepad2, bg: 'from-yellow-50 to-lime-100', text: 'text-yellow-600' };
      default: return { Icon: Gift, bg: 'from-emerald-50 to-teal-100', text: 'text-emerald-600' };
    }
  };

  const { Icon, bg, text } = getCategoryConfig(category);

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br shrink-0 flex items-center justify-center", bg, className)}>
      <Icon className={cn("w-1/2 h-1/2 absolute opacity-10", text)} />
      <span className={cn("text-xl font-bold uppercase tracking-widest z-10 opacity-40 text-center px-4 break-words line-clamp-3", text)}>
        {name}
      </span>
    </div>
  );
};

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

// --- Main App ---

type ThankYouEntry = {
  id: string;
  itemId: string;
  itemName: string;
  itemImageUrl?: string;
  itemCategory: string;
  gifterName: string;
  gifterEmail: string;
  message?: string;
  amountOrQuantity: string;
  thankYouSent: boolean;
  type: 'legacy' | 'claim' | 'contribution';
  index?: number;
};

const getThankYouEntries = (items: RegistryItem[]): ThankYouEntry[] => {
  const entries: ThankYouEntry[] = [];
  items.forEach(item => {
    if (item.claims && item.claims.length > 0) {
      item.claims.forEach((claim, index) => {
        if (claim.status === 'claimed') {
          entries.push({
            id: `${item.id}-claim-${index}`,
            itemId: item.id,
            itemName: item.name,
            itemImageUrl: item.imageUrl,
            itemCategory: item.category,
            gifterName: claim.userName,
            gifterEmail: claim.email,
            message: claim.message,
            amountOrQuantity: `Qty: ${claim.quantity}`,
            thankYouSent: !!claim.thankYouSent,
            type: 'claim',
            index
          });
        }
      });
    }
    
    if (item.contributions && item.contributions.length > 0) {
      item.contributions.forEach((contrib, index) => {
        entries.push({
          id: `${item.id}-contrib-${index}`,
          itemId: item.id,
          itemName: item.name,
          itemImageUrl: item.imageUrl,
          itemCategory: item.category,
          gifterName: contrib.userName,
          gifterEmail: contrib.email,
          message: contrib.message,
          amountOrQuantity: `Amount: $${contrib.amount}`,
          thankYouSent: !!contrib.thankYouSent,
          type: 'contribution',
          index
        });
      });
    } 
    
    if (!item.claims?.length && !item.contributions?.length && item.status === 'claimed' && item.claimedByEmail) {
      entries.push({
        id: `${item.id}-legacy`,
        itemId: item.id,
        itemName: item.name,
        itemImageUrl: item.imageUrl,
        itemCategory: item.category,
        gifterName: item.claimedByEmail,
        gifterEmail: item.claimedByEmail,
        message: item.guestMessage,
        amountOrQuantity: `Qty: ${item.quantity}`,
        thankYouSent: !!item.thankYouSent,
        type: 'legacy'
      });
    }
  });
  return entries;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [selectedRegistry, setSelectedRegistry] = useState<Registry | null>(null);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSizeGuideModalOpen, setIsSizeGuideModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isThankYouTrackerOpen, setIsThankYouTrackerOpen] = useState(false);
  const [isManageOwnersModalOpen, setIsManageOwnersModalOpen] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [claimingItem, setClaimingItem] = useState<RegistryItem | null>(null);
  const [contributingItem, setContributingItem] = useState<RegistryItem | null>(null);
  const [claimMode, setClaimMode] = useState<'claim' | 'reserve'>('claim');
  const [editingItem, setEditingItem] = useState<RegistryItem | null>(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [hideClaimed, setHideClaimed] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'price' | 'price-asc' | 'price-desc'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  const isOwner = selectedRegistry && user && (user.uid === selectedRegistry.ownerId || (user.email && selectedRegistry.coOwnerEmails?.includes(user.email.toLowerCase())));
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [fetchMetadataError, setFetchMetadataError] = useState<string | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  // Send Notification Helper
  const sendNotification = async (
    ownerId: string, 
    registryId: string, 
    itemId: string, 
    itemName: string, 
    type: 'claim' | 'reserve' | 'contribution',
    message: string
  ) => {
    if (!user) return;

    try {
      // Create Firestore Notification
      const notificationData = {
        userId: ownerId,
        registryId,
        itemId,
        itemName,
        type,
        message,
        guestName: user.displayName || 'A guest',
        guestEmail: user.email || '',
        read: false,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

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

  const isFirstSnapshot = useRef(true);

  // Request Notification Permission
  useEffect(() => {
    if (user && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  // Notifications Listener
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      isFirstSnapshot.current = true;
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      
      // Sort by createdAt desc
      newNotifications.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      // Browser Notifications Logic
      if (!isFirstSnapshot.current && typeof Notification !== 'undefined') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AppNotification;
            if (!data.read) {
              const title = `Registry Update!`;
              const body = `${data.guestName} has ${data.type === 'claim' ? 'claimed' : data.type === 'reserve' ? 'reserved' : 'contributed to'} ${data.itemName}.`;
              const options = {
                body,
                icon: '/pwa-192x192.png'
              };

              // Always show in-app toast notification
              toast(body, {
                icon: '🔔',
                duration: 5000,
              });

              // Trigger Browser Notification
              if (Notification.permission === 'granted') {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistration().then(registration => {
                    if (registration) {
                      registration.showNotification(title, options);
                    } else {
                      new Notification(title, options);
                    }
                  }).catch(() => {
                    new Notification(title, options);
                  });
                } else {
                  new Notification(title, options);
                }
              }
            }
          }
        });
      }
      isFirstSnapshot.current = false;

      setNotifications(newNotifications);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

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

      const q = query(
        collection(db, 'registries'), 
        or(
          where('ownerId', '==', user.uid),
          where('coOwnerEmails', 'array-contains', user.email.toLowerCase())
        )
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
      const registryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registry));
      setRegistries(registryData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registries');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

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

  // Handle Reservation Expiry
  useEffect(() => {
    if (items.length === 0) return;

    const checkExpirations = async () => {
      const now = Date.now();
      
      for (const item of items) {
        let needsUpdate = false;
        const updateData: any = {};

        // Check legacy reservation
        if (item.status === 'reserved' && item.reservedUntil) {
          const reservedTime = typeof item.reservedUntil === 'number' ? item.reservedUntil : item.reservedUntil.toMillis();
          if (reservedTime < now) {
            needsUpdate = true;
            updateData.status = 'available';
            updateData.claimedBy = null;
            updateData.claimedByEmail = null;
            updateData.claimedAt = null;
            updateData.reservedUntil = null;
            updateData.guestMessage = null;
          }
        }

        // Check multi-claim reservations
        if (item.claims && item.claims.length > 0) {
          const validClaims = item.claims.filter(claim => {
            if (claim.status === 'reserved' && claim.reservedUntil) {
              const reservedTime = typeof claim.reservedUntil === 'number' ? claim.reservedUntil : claim.reservedUntil.toMillis();
              return reservedTime >= now; // Keep if not expired
            }
            return true; // Keep claimed items
          });

          if (validClaims.length !== item.claims.length) {
            needsUpdate = true;
            updateData.claims = validClaims;
            
            // Recalculate quantities
            const newQuantityClaimed = validClaims.filter(c => c.status === 'claimed').reduce((sum, c) => sum + c.quantity, 0);
            const newQuantityReserved = validClaims.filter(c => c.status === 'reserved').reduce((sum, c) => sum + c.quantity, 0);
            
            updateData.quantityClaimed = newQuantityClaimed;
            updateData.quantityReserved = newQuantityReserved;
            updateData.status = newQuantityClaimed >= item.quantity ? 'claimed' : (newQuantityClaimed + newQuantityReserved >= item.quantity ? 'reserved' : 'available');
            
            // Sync legacy fields
            updateData.claimedBy = newQuantityClaimed >= item.quantity ? (validClaims.find(c => c.status === 'claimed')?.uid || null) : null;
            updateData.claimedByEmail = newQuantityClaimed >= item.quantity ? (validClaims.find(c => c.status === 'claimed')?.email || null) : null;
            updateData.claimedAt = newQuantityClaimed >= item.quantity ? (validClaims.find(c => c.status === 'claimed')?.createdAt || null) : null;
            if (newQuantityClaimed < item.quantity) {
              updateData.guestMessage = null;
            }
          }
        }

        if (needsUpdate) {
          try {
            const itemRef = doc(db, 'items', item.id);
            await updateDoc(itemRef, updateData);
          } catch (error) {
            console.error('Error expiring reservation:', error);
          }
        }
      }
    };

    const interval = setInterval(checkExpirations, 60000); // Check every minute
    checkExpirations(); // Initial check

    return () => clearInterval(interval);
  }, [items]);

  // Handle Deep Linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const registryId = params.get('registryId');
    const itemId = params.get('itemId');
    
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

    if (itemId && items.length > 0) {
      const element = document.getElementById(`item-${itemId}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-emerald-500', 'ring-offset-2', 'rounded-2xl');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-emerald-500', 'ring-offset-2', 'rounded-2xl');
          }, 3000);
        }, 500);
      }
    }
  }, [isAuthReady, items.length]);

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        // onAuthStateChanged will handle Firestore user creation
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error('Authentication failed:', error);
      if (error.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password sign-in is not enabled in Firebase. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else {
        setAuthError(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('Google Sign-In is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else {
        setAuthError(error.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const fetchItemMetadata = async (url: string): Promise<{ images: string[], title: string }> => {
    if (!url) return { images: [], title: '' };
    setIsFetchingMetadata(true);
    setFetchMetadataError(null);
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.images || data.images.length === 0) {
          setFetchMetadataError("No images found on this page. You can paste an image URL below.");
        }
        return { images: data.images || [], title: data.title || '' };
      } else {
        setFetchMetadataError("Failed to fetch images from this URL. You can paste an image URL below.");
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setFetchMetadataError("An error occurred while fetching images. You can paste an image URL below.");
    } finally {
      setIsFetchingMetadata(false);
    }
    return { images: [], title: '' };
  };

  const getCurrencySymbol = (code?: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || '$';
  };

  const getSeason = (month: number, hemisphere: 'northern' | 'southern') => {
    if (hemisphere === 'northern') {
      if (month === 11 || month <= 1) return 'Winter';
      if (month >= 2 && month <= 4) return 'Spring';
      if (month >= 5 && month <= 7) return 'Summer';
      return 'Autumn';
    } else {
      if (month === 11 || month <= 1) return 'Summer';
      if (month >= 2 && month <= 4) return 'Autumn';
      if (month >= 5 && month <= 7) return 'Winter';
      return 'Spring';
    }
  };

  const getSeasonsForPeriod = (startDate: Date, startMonthOffset: number, endMonthOffset: number, hemisphere: 'northern' | 'southern') => {
    const seasons = new Set<string>();
    for (let i = startMonthOffset; i <= endMonthOffset; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      seasons.add(getSeason(d.getMonth(), hemisphere));
    }
    return Array.from(seasons).join(' / ');
  };

  const getMonthRange = (startDate: Date, startOffset: number, endOffset: number) => {
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + startOffset);
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + endOffset);

    const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (startOffset === endOffset) return format(start);
    return `${format(start)} - ${format(end)}`;
  };

  const generateSizeGuide = (dueDate: string, hemisphere: 'northern' | 'southern' = 'northern') => {
    if (!dueDate) return [];
    const start = new Date(dueDate);
    return [
      { size: 'Newborn', age: '0 months', months: getMonthRange(start, 0, 0), seasons: getSeasonsForPeriod(start, 0, 0, hemisphere) },
      { size: '0-3 Months', age: '0-3 months', months: getMonthRange(start, 0, 2), seasons: getSeasonsForPeriod(start, 0, 2, hemisphere) },
      { size: '3-6 Months', age: '3-6 months', months: getMonthRange(start, 3, 5), seasons: getSeasonsForPeriod(start, 3, 5, hemisphere) },
      { size: '6-12 Months', age: '6-12 months', months: getMonthRange(start, 6, 11), seasons: getSeasonsForPeriod(start, 6, 11, hemisphere) },
      { size: '12-18 Months', age: '12-18 months', months: getMonthRange(start, 12, 17), seasons: getSeasonsForPeriod(start, 12, 17, hemisphere) },
      { size: '18-24 Months', age: '18-24 months', months: getMonthRange(start, 18, 23), seasons: getSeasonsForPeriod(start, 18, 23, hemisphere) },
    ];
  };

  const createRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const babyName = formData.get('babyName') as string;
    const dueDate = formData.get('dueDate') as string;
    const description = formData.get('description') as string;
    const welcomeMessage = formData.get('welcomeMessage') as string;
    const currency = formData.get('currency') as string;
    const hemisphere = formData.get('hemisphere') as string || 'northern';

    try {
      await addDoc(collection(db, 'registries'), {
        babyName,
        dueDate,
        description,
        welcomeMessage,
        currency,
        hemisphere,
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
    const welcomeMessage = formData.get('welcomeMessage') as string;
    const currency = formData.get('currency') as string;
    const hemisphere = formData.get('hemisphere') as string || 'northern';

    try {
      const registryRef = doc(db, 'registries', selectedRegistry.id);
      await updateDoc(registryRef, {
        babyName,
        dueDate,
        description,
        welcomeMessage,
        currency,
        hemisphere
      });
      setSelectedRegistry({
        ...selectedRegistry,
        babyName,
        dueDate,
        description,
        welcomeMessage,
        currency,
        hemisphere: hemisphere as 'northern' | 'southern'
      });
      setIsSettingsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `registries/${selectedRegistry.id}`);
    }
  };

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegistry || !newOwnerEmail.trim()) return;

    try {
      const registryRef = doc(db, 'registries', selectedRegistry.id);
      await updateDoc(registryRef, {
        coOwnerEmails: arrayUnion(newOwnerEmail.trim().toLowerCase())
      });
      
      // Also update local state
      const updatedCoOwners = [...(selectedRegistry.coOwnerEmails || []), newOwnerEmail.trim().toLowerCase()];
      setSelectedRegistry({
        ...selectedRegistry,
        coOwnerEmails: updatedCoOwners
      });
      
      setNewOwnerEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `registries/${selectedRegistry.id}`);
    }
  };

  const handleRemoveOwner = async (emailToRemove: string) => {
    if (!selectedRegistry) return;
    
    try {
      const registryRef = doc(db, 'registries', selectedRegistry.id);
      await updateDoc(registryRef, {
        coOwnerEmails: arrayRemove(emailToRemove)
      });
      
      // Also update local state
      const updatedCoOwners = (selectedRegistry.coOwnerEmails || []).filter(email => email !== emailToRemove);
      setSelectedRegistry({
        ...selectedRegistry,
        coOwnerEmails: updatedCoOwners
      });
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
    const isGroupGifting = formData.get('isGroupGifting') === 'on';
    const isMustHave = formData.get('isMustHave') === 'on';

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
        createdAt: serverTimestamp(),
        isGroupGifting,
        isMustHave,
        amountContributed: 0,
        contributions: [],
        quantityClaimed: 0,
        quantityReserved: 0,
        claims: []
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

  const handleBatchAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedRegistry) return;

    const formData = new FormData(e.currentTarget);
    const text = formData.get('itemsText') as string;
    const category = formData.get('category') as string;
    
    if (!text.trim()) return;

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    setIsSubmittingBatch(true);
    try {
      const promises = lines.map(line => {
        return addDoc(collection(db, 'items'), {
          registryId: selectedRegistry.id,
          name: line,
          description: '',
          price: null,
          quantity: 1,
          url: '',
          imageUrl: null,
          category: category || 'Other',
          status: 'available',
          addedBy: user.uid,
          createdAt: serverTimestamp(),
          isGroupGifting: false,
          amountContributed: 0,
          contributions: [],
          quantityClaimed: 0,
          quantityReserved: 0,
          claims: []
        });
      });
      await Promise.all(promises);
      setIsBatchAddModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const editItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingItem) return;

    const formData = new FormData(e.currentTarget);
    const priceVal = formData.get('price');
    const price = (priceVal !== null && priceVal !== "") ? Number(priceVal) : null;
    const url = formData.get('url') as string;
    const isGroupGifting = formData.get('isGroupGifting') === 'on';
    const isMustHave = formData.get('isMustHave') === 'on';

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
        isGroupGifting,
        isMustHave
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

  const claimItem = (item: RegistryItem) => {
    if (!user) {
      alert('Please sign in to claim an item!');
      return;
    }
    setClaimingItem(item);
    setClaimMode('claim');
    setIsClaimModalOpen(true);
  };

  const reserveItem = (item: RegistryItem) => {
    if (!user) {
      alert('Please sign in to reserve an item!');
      return;
    }
    setClaimingItem(item);
    setClaimMode('reserve');
    setIsClaimModalOpen(true);
  };

  const handleClaim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !claimingItem) return;

    const formData = new FormData(e.currentTarget);
    const message = formData.get('guestMessage') as string;
    const quantityToClaim = Number(formData.get('quantity') || 1);

    try {
      const itemRef = doc(db, 'items', claimingItem.id);
      const now = Date.now();
      const expiry = Timestamp.fromMillis(now + (48 * 60 * 60 * 1000)); // 48 hours from now

      const currentClaimed = claimingItem.quantityClaimed || 0;
      const currentReserved = claimingItem.quantityReserved || 0;
      
      const newQuantityClaimed = claimMode === 'claim' ? currentClaimed + quantityToClaim : currentClaimed;
      const newQuantityReserved = claimMode === 'reserve' ? currentReserved + quantityToClaim : currentReserved;
      
      const isFullyClaimed = newQuantityClaimed >= claimingItem.quantity;
      const isPartiallyClaimed = (newQuantityClaimed + newQuantityReserved) > 0;
      const isFullyReserved = (newQuantityClaimed + newQuantityReserved) >= claimingItem.quantity;

      const newClaim = {
        uid: user.uid,
        email: user.email || '',
        userName: user.displayName || 'Anonymous',
        quantity: quantityToClaim,
        message: message || null,
        status: claimMode === 'claim' ? 'claimed' : 'reserved',
        createdAt: Timestamp.now(),
        reservedUntil: claimMode === 'reserve' ? expiry : null
      };

      await updateDoc(itemRef, {
        claims: arrayUnion(newClaim),
        quantityClaimed: newQuantityClaimed,
        quantityReserved: newQuantityReserved,
        status: isFullyClaimed ? 'claimed' : (isFullyReserved ? 'reserved' : 'available'),
        // Keep these for backward compatibility/single person view if needed
        claimedBy: isFullyClaimed ? user.uid : (claimingItem.claimedBy || null),
        claimedByEmail: isFullyClaimed ? user.email : (claimingItem.claimedByEmail || null),
        claimedAt: isFullyClaimed ? serverTimestamp() : (claimingItem.claimedAt || null),
        guestMessage: isFullyClaimed ? message : (claimingItem.guestMessage || null),
        reservedUntil: isFullyReserved && claimMode === 'reserve' ? expiry : (claimingItem.reservedUntil || null)
      });

      // Send Notification
      if (selectedRegistry) {
        sendNotification(
          selectedRegistry.ownerId,
          selectedRegistry.id,
          claimingItem.id,
          claimingItem.name,
          claimMode === 'claim' ? 'claim' : 'reserve',
          message || ''
        );
      }

      setIsClaimModalOpen(false);
      setClaimingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${claimingItem.id}`);
    }
  };

  const handleContribute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !contributingItem) return;

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const message = formData.get('message') as string;

    if (isNaN(amount) || amount <= 0) return;

    try {
      const itemRef = doc(db, 'items', contributingItem.id);
      const currentAmount = contributingItem.amountContributed || 0;
      const newAmountContributed = currentAmount + amount;
      const isFullyFunded = newAmountContributed >= (contributingItem.price || 0);

      const contribution = {
        uid: user.uid,
        email: user.email || '',
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        amount,
        message: message || null,
        createdAt: Date.now()
      };

      await updateDoc(itemRef, {
        amountContributed: newAmountContributed,
        contributions: arrayUnion(contribution),
        status: isFullyFunded ? 'claimed' : 'available',
        claimedBy: isFullyFunded ? user.uid : null,
        claimedByEmail: isFullyFunded ? user.email : null,
        claimedAt: isFullyFunded ? serverTimestamp() : null
      });

      // Send Notification
      if (selectedRegistry) {
        sendNotification(
          selectedRegistry.ownerId,
          selectedRegistry.id,
          contributingItem.id,
          contributingItem.name,
          'contribution',
          `Contributed ${selectedRegistry.currency || 'R'}${amount} towards this item. ${message ? `Message: ${message}` : ''}`
        );
      }

      setIsContributeModalOpen(false);
      setContributingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${contributingItem.id}`);
    }
  };

  const toggleThankYouSent = async (entry: ThankYouEntry) => {
    try {
      const itemRef = doc(db, 'items', entry.itemId);
      const item = items.find(i => i.id === entry.itemId);
      if (!item) return;

      if (entry.type === 'legacy') {
        await updateDoc(itemRef, {
          thankYouSent: !entry.thankYouSent
        });
      } else if (entry.type === 'claim' && entry.index !== undefined && item.claims) {
        const newClaims = [...item.claims];
        newClaims[entry.index].thankYouSent = !entry.thankYouSent;
        await updateDoc(itemRef, {
          claims: newClaims
        });
      } else if (entry.type === 'contribution' && entry.index !== undefined && item.contributions) {
        const newContribs = [...item.contributions];
        newContribs[entry.index].thankYouSent = !entry.thankYouSent;
        await updateDoc(itemRef, {
          contributions: newContribs
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${entry.itemId}`);
    }
  };

  const markAsPurchased = async (item: RegistryItem) => {
    if (!user || !isOwner) return;

    const remainingQty = item.quantity - (item.quantityClaimed || 0) - (item.quantityReserved || 0);
    if (remainingQty <= 0) return;

    try {
      const itemRef = doc(db, 'items', item.id);
      
      const newClaim = {
        uid: user.uid,
        email: user.email || '',
        userName: user.displayName || 'Owner',
        quantity: remainingQty,
        message: 'Marked as purchased by owner',
        status: 'claimed',
        createdAt: Timestamp.now(),
        reservedUntil: null
      };

      await updateDoc(itemRef, {
        claims: arrayUnion(newClaim),
        quantityClaimed: (item.quantityClaimed || 0) + remainingQty,
        status: 'claimed',
        claimedBy: user.uid,
        claimedByEmail: user.email,
        claimedAt: serverTimestamp(),
        guestMessage: 'Marked as purchased by owner',
        reservedUntil: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${item.id}`);
    }
  };

  const unclaimItem = async (item: RegistryItem) => {
    if (!user) return;
    
    // Check if user has any claims
    const userClaims = item.claims?.filter(c => c.uid === user.uid) || [];
    const isLegacyOwner = item.claimedBy === user.uid;
    
    if (userClaims.length === 0 && !isLegacyOwner) return;

    try {
      const itemRef = doc(db, 'items', item.id);
      
      if (item.claims && item.claims.length > 0) {
        const updatedClaims = item.claims.filter(c => c.uid !== user.uid);
        const newQuantityClaimed = updatedClaims.filter(c => c.status === 'claimed').reduce((acc, c) => acc + c.quantity, 0);
        const newQuantityReserved = updatedClaims.filter(c => c.status === 'reserved').reduce((acc, c) => acc + c.quantity, 0);
        
        await updateDoc(itemRef, {
          claims: updatedClaims,
          quantityClaimed: newQuantityClaimed,
          quantityReserved: newQuantityReserved,
          status: newQuantityClaimed >= item.quantity ? 'claimed' : (newQuantityClaimed + newQuantityReserved >= item.quantity ? 'reserved' : 'available'),
          // Sync legacy fields
          claimedBy: newQuantityClaimed >= item.quantity ? (updatedClaims.find(c => c.status === 'claimed')?.uid || null) : null,
          claimedByEmail: newQuantityClaimed >= item.quantity ? (updatedClaims.find(c => c.status === 'claimed')?.email || null) : null,
          claimedAt: newQuantityClaimed >= item.quantity ? (updatedClaims.find(c => c.status === 'claimed')?.createdAt || null) : null,
          guestMessage: newQuantityClaimed >= item.quantity ? (updatedClaims.find(c => c.status === 'claimed')?.message || null) : null,
          reservedUntil: null
        });
      } else {
        // Legacy unclaim
        await updateDoc(itemRef, {
          status: 'available',
          claimedBy: null,
          claimedByEmail: null,
          claimedAt: null,
          reservedUntil: null,
          guestMessage: null,
          quantityClaimed: 0,
          quantityReserved: 0,
          claims: []
        });
      }
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
                  
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
                      className="p-2 relative"
                    >
                      <Bell className="w-5 h-5 text-stone-600" />
                      {notifications.filter(n => !n.read).length > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
                      )}
                    </Button>
                    
                    <AnimatePresence>
                      {isNotificationsOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-50"
                        >
                          <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                            <h3 className="font-bold text-stone-900">Notifications</h3>
                            {notifications.length > 0 && (
                              <button 
                                onClick={markAllNotificationsRead}
                                className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                              >
                                Mark all as read
                              </button>
                            )}
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="p-8 text-center">
                                <Bell className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                                <p className="text-sm text-stone-400 font-medium">No notifications yet</p>
                              </div>
                            ) : (
                              notifications.map(notification => (
                                <div 
                                  key={notification.id}
                                  className={cn(
                                    "p-4 border-b border-stone-50 last:border-0 transition-colors cursor-pointer hover:bg-stone-50 text-left",
                                    !notification.read && "bg-emerald-50/30"
                                  )}
                                  onClick={() => markNotificationRead(notification.id)}
                                >
                                  <div className="flex gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                      notification.type === 'claim' ? "bg-emerald-100 text-emerald-600" :
                                      notification.type === 'reserve' ? "bg-amber-100 text-amber-600" :
                                      "bg-blue-100 text-blue-600"
                                    )}>
                                      {notification.type === 'claim' ? <Heart className="w-4 h-4" /> :
                                       notification.type === 'reserve' ? <Clock className="w-4 h-4" /> :
                                       <Gift className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-stone-900 leading-tight">
                                        <span className="font-bold">{notification.guestName}</span> {
                                          notification.type === 'claim' ? 'claimed' :
                                          notification.type === 'reserve' ? 'reserved' :
                                          'contributed to'
                                        } <span className="font-medium text-emerald-700">{notification.itemName}</span>
                                      </p>
                                      {notification.message && (
                                        <p className="text-xs text-stone-500 mt-1 line-clamp-2 italic">"{notification.message}"</p>
                                      )}
                                      <p className="text-[10px] text-stone-400 mt-1">
                                        {notification.createdAt?.toMillis ? new Date(notification.createdAt.toMillis()).toLocaleString() : 'Just now'}
                                      </p>
                                    </div>
                                    {!notification.read && (
                                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                  <Button variant="ghost" onClick={handleLogout} className="p-2">
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsAuthModalOpen(true)} disabled={isLoggingIn}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showInstallPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Download className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-900">Install Little Steps Registry</h3>
                <p className="text-sm text-emerald-700">Add this app to your home screen for quick access and offline support.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button onClick={handleInstallClick} className="w-full sm:w-auto">Install Now</Button>
              <Button variant="ghost" onClick={() => setShowInstallPrompt(false)} className="w-full sm:w-auto">Maybe Later</Button>
            </div>
          </motion.div>
        )}
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
                        {(user?.uid === registry.ownerId || (user?.email && registry.coOwnerEmails?.includes(user.email.toLowerCase()))) && (
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
                {selectedRegistry.welcomeMessage && (
                  <div className="mt-4 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-sm">
                    {selectedRegistry.welcomeMessage}
                  </div>
                )}
                
                {/* Progress Tracker */}
                {items.length > 0 && (
                  <div className="mt-6 max-w-md">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-stone-700">Registry Progress</span>
                      <span className="text-xs font-medium text-stone-500">
                        {items.reduce((acc, item) => acc + (item.status === 'claimed' ? item.quantity : (item.quantityClaimed || 0)), 0)} of {items.reduce((acc, item) => acc + item.quantity, 0)} items claimed
                      </span>
                    </div>
                    <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${items.reduce((acc, item) => acc + item.quantity, 0) > 0 ? Math.round((items.reduce((acc, item) => acc + (item.status === 'claimed' ? item.quantity : (item.quantityClaimed || 0)), 0) / items.reduce((acc, item) => acc + item.quantity, 0)) * 100) : 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedRegistry.dueDate && (
                  <Button variant="outline" onClick={() => setIsSizeGuideModalOpen(true)} title="Size Guide">
                    <Ruler className="w-4 h-4 mr-2" />
                    Size Guide
                  </Button>
                )}
                <Button variant="outline" onClick={handleShare} title="Share Registry">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {isOwner && (
                  <>
                    <Button variant="outline" onClick={() => setIsThankYouTrackerOpen(!isThankYouTrackerOpen)} title="Thank You Tracker">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {isThankYouTrackerOpen ? 'Back to Registry' : 'Thank You Tracker'}
                    </Button>
                    <Button variant="outline" onClick={() => setIsManageOwnersModalOpen(true)} title="Manage Owners">
                      <Users className="w-4 h-4 mr-2" />
                      Owners
                    </Button>
                    <Button variant="outline" onClick={() => setIsSettingsModalOpen(true)} title="Registry Settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isThankYouTrackerOpen ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-stone-100 p-8 shadow-sm"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-stone-900">Thank You Note Tracker</h3>
                    <p className="text-stone-500">Keep track of who you've thanked for their generous gifts.</p>
                  </div>
                  <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <span className="text-emerald-700 font-bold text-lg">
                      {getThankYouEntries(items).filter(e => e.thankYouSent).length} / {getThankYouEntries(items).length}
                    </span>
                    <span className="text-emerald-600 text-sm ml-2 font-medium">Sent</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {getThankYouEntries(items).length === 0 ? (
                    <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <Clock className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                      <p className="text-stone-500 font-medium">No items have been claimed yet.</p>
                    </div>
                  ) : (
                    getThankYouEntries(items)
                      .sort((a, b) => (a.thankYouSent === b.thankYouSent ? 0 : a.thankYouSent ? 1 : -1))
                      .map((entry) => (
                        <div 
                          key={entry.id} 
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all",
                            entry.thankYouSent 
                              ? "bg-stone-50 border-stone-100 opacity-75" 
                              : "bg-white border-stone-100 shadow-sm hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            {entry.itemImageUrl ? (
                              <img src={entry.itemImageUrl} alt={entry.itemName} className="w-16 h-16 rounded-xl object-cover bg-stone-100" />
                            ) : (
                              <CategoryPlaceholder category={entry.itemCategory} name={entry.itemName} className="w-16 h-16 rounded-xl" />
                            )}
                            <div>
                              <h4 className="font-bold text-stone-900">{entry.itemName}</h4>
                              <p className="text-sm text-stone-500">From: <span className="font-semibold text-stone-700">{entry.gifterName || entry.gifterEmail || 'Anonymous'}</span> <span className="text-stone-400 mx-1">•</span> {entry.amountOrQuantity}</p>
                              {entry.message && (
                                <div className="mt-2 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50 italic text-xs text-stone-600">
                                  "{entry.message}"
                                </div>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant={entry.thankYouSent ? "outline" : "primary"}
                            onClick={() => toggleThankYouSent(entry)}
                            className="sm:w-auto w-full"
                          >
                            {entry.thankYouSent ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Sent
                              </>
                            ) : (
                              'Mark as Sent'
                            )}
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </motion.div>
            ) : (
              <>
                {/* Filter and Sort */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {['All', 'Gear', 'Clothing', 'Feeding', 'Nursery', 'Toys', 'Other'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                          filterCategory === cat 
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                            : "bg-white text-stone-600 border border-stone-100 hover:bg-stone-50"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-white p-1 rounded-xl border border-stone-100 shadow-sm">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          viewMode === 'grid' ? "bg-emerald-50 text-emerald-600" : "text-stone-400 hover:text-stone-600"
                        )}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          viewMode === 'list' ? "bg-emerald-50 text-emerald-600" : "text-stone-400 hover:text-stone-600"
                        )}
                        title="List View"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-stone-100 shadow-sm">
                      <label className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={hideClaimed}
                          onChange={(e) => setHideClaimed(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-medium text-stone-600">Hide Claimed</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-stone-100 shadow-sm">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider ml-2 mr-1">Sort:</span>
                      <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-xs font-medium text-stone-600 outline-none pr-2 py-1 cursor-pointer"
                      >
                        <option value="date">Date Added</option>
                        <option value="name">Name</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                      </select>
                    </div>

                    {isOwner && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="rounded-xl px-4 py-2 text-xs h-auto"
                          onClick={() => setIsBatchAddModalOpen(true)}
                        >
                          <List className="w-4 h-4 mr-1.5" />
                          Batch Add
                        </Button>
                        <Button 
                          className="rounded-xl px-4 py-2 text-xs h-auto"
                          onClick={() => {
                            setFetchMetadataError(null);
                            setIsAddItemModalOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Add Item
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Grid/List */}
                <div className={cn(
                  "grid",
                  viewMode === 'grid' ? "gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "gap-3 grid-cols-1"
                )}>
                  {items
                    .filter(item => filterCategory === 'All' || item.category === filterCategory)
                    .filter(item => !hideClaimed || item.status !== 'claimed')
                    .sort((a, b) => {
                      if (sortBy === 'name') return a.name.localeCompare(b.name);
                      if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
                      if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
                      if (sortBy === 'price') return (a.price || 0) - (b.price || 0); // fallback
                      // Default to date added (newest first)
                      const dateA = a.createdAt?.seconds || 0;
                      const dateB = b.createdAt?.seconds || 0;
                      return dateB - dateA;
                    })
                    .map((item) => (
                    <motion.div key={item.id} id={`item-${item.id}`} layout>
                      <Card className={cn(
                        'transition-all overflow-hidden',
                        viewMode === 'grid' ? 'h-full flex flex-col' : 'flex flex-col sm:flex-row',
                        item.status === 'claimed' ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-md'
                      )}>
                        {item.imageUrl ? (
                          <div className={cn(
                            "relative overflow-hidden bg-stone-100 border-stone-50 shrink-0",
                            viewMode === 'grid' ? "aspect-[4/3] w-full border-b" : "w-full h-40 sm:w-32 sm:h-auto self-stretch border-b sm:border-b-0 sm:border-r"
                          )}>
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="absolute inset-0 w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <CategoryPlaceholder 
                            category={item.category} 
                            name={item.name} 
                            className={viewMode === 'grid' ? "aspect-[4/3] w-full border-b" : "w-full h-40 sm:w-32 sm:h-auto self-stretch border-b sm:border-b-0 sm:border-r"} 
                          />
                        )}
                        <div className={cn(
                          "p-3 sm:p-4 flex-1 flex flex-col min-w-0",
                          viewMode === 'list' && "justify-between"
                        )}>
                          <div className={cn(
                            "flex justify-between items-start gap-2",
                            viewMode === 'grid' ? "mb-2" : "mb-1"
                          )}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                {item.category || 'General'}
                              </span>
                              {item.isMustHave && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <Heart className="w-3 h-3 fill-rose-600" />
                                  Must-Have
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = new URL(window.location.href);
                                  url.searchParams.set('registryId', selectedRegistry.id);
                                  url.searchParams.set('itemId', item.id);
                                  navigator.clipboard.writeText(url.toString());
                                  setShowShareToast(true);
                                  setTimeout(() => setShowShareToast(false), 3000);
                                }}
                                className="text-stone-300 hover:text-emerald-600 transition-colors"
                                title="Share Item"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              {isOwner && (
                                <>
                                  <button 
                                    onClick={() => {
                                      setEditingItem(item);
                                      setSelectedImageUrl(item.imageUrl || null);
                                      setFetchMetadataError(null);
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
                                </>
                              )}
                            </div>
                          </div>
                          <h4 className={cn(
                            "font-bold text-stone-900 mb-0.5",
                            viewMode === 'grid' ? "text-base" : "text-sm"
                          )}>{item.name}</h4>
                          {item.description && (
                            <p className={cn(
                              "text-stone-500 text-xs line-clamp-2",
                              viewMode === 'grid' ? "mb-1.5" : "mb-1"
                            )}>
                              {item.description}
                            </p>
                          )}
                          <div className={cn(
                            "flex items-center gap-2",
                            viewMode === 'grid' ? "mb-2" : "mb-1"
                          )}>
                            <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">
                              Qty: {item.quantity || 1}
                            </span>
                            {item.quantity > 1 && (
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                (item.quantityClaimed || 0) + (item.quantityReserved || 0) >= item.quantity 
                                  ? "text-emerald-600 bg-emerald-50" 
                                  : "text-amber-600 bg-amber-50"
                              )}>
                                {item.quantity - (item.quantityClaimed || 0) - (item.quantityReserved || 0)} left
                              </span>
                            )}
                          </div>

                          {item.quantity > 1 && (item.quantityClaimed || 0) + (item.quantityReserved || 0) > 0 && (
                            <div className={cn(
                              "relative h-1.5 w-full bg-stone-100 rounded-full overflow-hidden",
                              viewMode === 'grid' ? "mb-2" : "mb-1"
                            )}>
                              <div 
                                className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-500 z-10"
                                style={{ width: `${((item.quantityClaimed || 0) / item.quantity) * 100}%` }}
                              />
                              <div 
                                className="absolute left-0 top-0 h-full bg-amber-400/50 transition-all duration-500"
                                style={{ width: `${(((item.quantityClaimed || 0) + (item.quantityReserved || 0)) / item.quantity) * 100}%` }}
                              />
                            </div>
                          )}

                          {isOwner && item.claims && item.claims.length > 0 && (
                            <div className={cn(
                              "pt-2 border-t border-stone-100",
                              viewMode === 'grid' ? "mb-2" : "mb-1"
                            )}>
                              <h5 className="text-[9px] font-bold text-stone-400 mb-1 uppercase tracking-wider">Claimed By</h5>
                              <div className="flex flex-wrap gap-1">
                                {item.claims.map((c, idx) => (
                                  <span key={idx} className="text-[9px] bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100 text-stone-600">
                                    {c.userName} ({c.quantity})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.isGroupGifting && item.price != null && (
                            <div className={cn(
                              viewMode === 'grid' ? "mb-2" : "mb-1"
                            )}>
                              <div className="flex justify-between text-[10px] text-stone-500 mb-1">
                                <span>Group Gift Progress</span>
                                <span>{Math.round(((item.amountContributed || 0) / item.price) * 100)}%</span>
                              </div>
                              <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, ((item.amountContributed || 0) / item.price) * 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-stone-400 mt-1">
                                <span>{getCurrencySymbol(selectedRegistry.currency)}{item.amountContributed || 0}</span>
                                <span>Target: {getCurrencySymbol(selectedRegistry.currency)}{item.price}</span>
                              </div>
                            </div>
                          )}

                          {isOwner && item.isGroupGifting && item.contributions && item.contributions.length > 0 && (
                            <div className={cn(
                              "pt-2 border-t border-stone-100",
                              viewMode === 'grid' ? "mb-2" : "mb-1"
                            )}>
                              <h5 className="text-[9px] font-bold text-stone-400 mb-1 uppercase tracking-wider">Contributions</h5>
                              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                {item.contributions.map((c, idx) => (
                                  <div key={idx} className="text-[11px] bg-stone-50 p-2 rounded-lg border border-stone-100">
                                    <div className="flex justify-between font-medium text-stone-800 mb-0.5">
                                      <span>{c.userName}</span>
                                      <span className="text-emerald-600">{getCurrencySymbol(selectedRegistry.currency)}{c.amount}</span>
                                    </div>
                                    {c.message && <p className="text-stone-500 italic">"{c.message}"</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-auto">
                            {item.price != null ? (
                              <span className={cn(
                                "font-bold text-stone-900",
                                viewMode === 'grid' ? "text-lg" : "text-sm"
                              )}>
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
                                className={cn(
                                  "inline-flex items-center gap-1 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-lg transition-colors shadow-sm",
                                  viewMode === 'grid' ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[10px]"
                                )}
                              >
                                <span>View Item</span>
                                <ExternalLink className={viewMode === 'grid' ? "w-4 h-4" : "w-2.5 h-2.5"} />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className={cn(
                          "p-3 sm:p-4 bg-stone-50 border-stone-100 shrink-0",
                          viewMode === 'grid' ? "border-t" : "border-t sm:border-t-0 sm:border-l flex flex-col justify-center w-full sm:w-40"
                        )}>
                          {(() => {
                            const userClaim = item.claims?.find(c => c.uid === user?.uid);
                            const isLegacyOwner = item.claimedBy === user?.uid;
                            const hasClaim = userClaim || isLegacyOwner;
                            const remainingQty = item.quantity - (item.quantityClaimed || 0) - (item.quantityReserved || 0);

                            if (item.isGroupGifting && item.status === 'available') {
                              return (
                                <div className={cn(
                                  "flex gap-2",
                                  viewMode === 'list' ? "flex-col" : "flex-row"
                                )}>
                                  <Button 
                                    className={cn("text-[10px] h-8", viewMode === 'grid' ? "flex-1" : "w-full")} 
                                    variant="primary"
                                    onClick={() => {
                                      setContributingItem(item);
                                      setIsContributeModalOpen(true);
                                    }}
                                    disabled={!user}
                                    title={!user ? "Sign in to contribute" : ""}
                                  >
                                    <Gift className={viewMode === 'grid' ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1.5"} />
                                    {user ? 'Contribute' : 'Sign in'}
                                  </Button>
                                  <Button 
                                    className={cn("text-[10px] h-8", viewMode === 'grid' ? "flex-1" : "w-full")} 
                                    variant="outline"
                                    onClick={() => claimItem(item)}
                                    disabled={!user}
                                    title={!user ? "Sign in to claim full item" : ""}
                                  >
                                    <Heart className={viewMode === 'grid' ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1.5"} />
                                    {user ? 'Claim Full' : 'Sign in'}
                                  </Button>
                                </div>
                              );
                            }

                            if (hasClaim) {
                              const claimStatus = userClaim?.status || item.status;
                              const isClaimed = claimStatus === 'claimed';
                              const claimQty = userClaim?.quantity || item.quantity;

                              return (
                                <div className={cn(
                                  viewMode === 'grid' ? "space-y-3" : "space-y-1.5"
                                )}>
                                  <div className="flex items-center justify-between">
                                    <div className={cn(
                                      "flex items-center gap-2 text-sm font-semibold",
                                      isClaimed ? "text-emerald-600" : "text-amber-600"
                                    )}>
                                      {isClaimed ? (
                                        <CheckCircle className={viewMode === 'grid' ? "w-4 h-4" : "w-3.5 h-3.5"} />
                                      ) : (
                                        <Clock className={viewMode === 'grid' ? "w-4 h-4" : "w-3.5 h-3.5"} />
                                      )}
                                      <span>{isClaimed ? 'Claimed' : 'Reserved'}{item.quantity > 1 ? ` (${claimQty})` : ''}</span>
                                    </div>
                                    <Button variant="ghost" onClick={() => unclaimItem(item)} className="text-[10px] h-7 px-2">
                                      {isClaimed ? 'Unclaim' : 'Unreserve'}
                                    </Button>
                                  </div>
                                  
                                  {remainingQty > 0 && (
                                    <Button 
                                      variant="outline" 
                                      onClick={() => claimItem(item)}
                                      className="w-full text-[10px] h-8 mt-2 border-dashed"
                                    >
                                      <Plus className="w-3 h-3 mr-1.5" />
                                      Claim More ({remainingQty})
                                    </Button>
                                  )}
                                </div>
                              );
                            }

                            if (item.status === 'claimed') {
                              return (
                                <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold justify-center py-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Fully Claimed</span>
                                </div>
                              );
                            }

                            if (item.status === 'reserved' && remainingQty <= 0) {
                              return (
                                <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold justify-center py-2">
                                  <Clock className="w-4 h-4" />
                                  <span>Fully Reserved</span>
                                </div>
                              );
                            }

                            return (
                              <div className={cn(
                                "flex gap-2",
                                viewMode === 'list' ? "flex-col" : "flex-row"
                              )}>
                                <Button 
                                  className={cn("text-[10px] h-8", viewMode === 'grid' ? "flex-1" : "w-full")} 
                                  variant="outline"
                                  onClick={() => claimItem(item)}
                                  disabled={!user || remainingQty <= 0}
                                  title={!user ? "Sign in to claim this item" : ""}
                                >
                                  <Heart className={viewMode === 'grid' ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1.5"} />
                                  {user ? (item.quantity > 1 ? 'Claim Some' : 'Claim') : 'Sign in'}
                                </Button>
                                {isOwner ? (
                                  <Button 
                                    className={cn("text-[10px] h-8", viewMode === 'grid' ? "flex-1" : "w-full")} 
                                    variant="ghost"
                                    onClick={() => markAsPurchased(item)}
                                    disabled={!user || remainingQty <= 0}
                                  >
                                    <CheckCircle className={viewMode === 'grid' ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1.5"} />
                                    Mark Purchased
                                  </Button>
                                ) : (
                                  <Button 
                                    className={cn("text-[10px] h-8", viewMode === 'grid' ? "flex-1" : "w-full")} 
                                    variant="ghost"
                                    onClick={() => reserveItem(item)}
                                    disabled={!user || remainingQty <= 0}
                                    title={!user ? "Sign in to reserve this item" : ""}
                                  >
                                    <Clock className={viewMode === 'grid' ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1.5"} />
                                    {user ? (item.quantity > 1 ? 'Reserve Some' : 'Reserve') : 'Sign in'}
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
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
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isAuthModalOpen} 
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthError(null);
        }} 
        title={authMode === 'login' ? 'Sign In' : 'Create Account'}
      >
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authError && (
            <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">
              {authError}
            </div>
          )}
          {authMode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
              <input 
                name="displayName" 
                required 
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input 
              name="email" 
              type="email"
              required 
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input 
              name="password" 
              type="password"
              required 
              minLength={6}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full py-3" disabled={isLoggingIn}>
            {isLoggingIn ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
          </Button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-stone-300 rounded-xl bg-white text-stone-700 font-medium hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>

          <div className="text-center mt-4">
            <button 
              type="button" 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError(null);
              }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
      </Modal>

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
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="e.g. Baby Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Due Date (Optional)</label>
            <input 
              name="dueDate" 
              type="date"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={3}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="A little bit about your registry..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Welcome Message (Optional)</label>
            <textarea 
              name="welcomeMessage" 
              rows={2}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="A special note for your guests..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Currency</label>
              <select 
                name="currency"
                defaultValue="USD"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
              <select 
                name="hemisphere"
                defaultValue="southern"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                <option value="northern">Northern Hemisphere</option>
                <option value="southern">Southern Hemisphere</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full py-3">Create Registry</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isBatchAddModalOpen} 
        onClose={() => setIsBatchAddModalOpen(false)} 
        title="Batch Add Items"
      >
        <form onSubmit={handleBatchAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Items List</label>
            <p className="text-xs text-stone-500 mb-2">Paste a list of items, one per line. Each line will become a separate item in your registry.</p>
            <textarea 
              name="itemsText" 
              required 
              rows={8}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all custom-scrollbar"
              placeholder="Saline nose spray&#10;Baba hangers&#10;Sudocrem/oh lief bum balm&#10;Bad goedjies en roompies (oh lief, epimax, Aveeno)&#10;Doeke (huggies extra care, huggies Gold, pampers premium, pampers)&#10;Mussies (blou, wit, grys, cream, groen)&#10;Vessies alles grotes van 3 tot 24 maande langmou en kortmou afhangend van seisoen&#10;Fluffy onesies, double sided zip, newborn."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category (Optional)</label>
            <select 
              name="category" 
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="">Select a category for all items...</option>
              <option value="Gear">Gear & Travel</option>
              <option value="Clothing">Clothing</option>
              <option value="Feeding">Feeding</option>
              <option value="Nursery">Nursery</option>
              <option value="Toys">Toys & Play</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <Button type="submit" className="w-full py-3" disabled={isSubmittingBatch}>
            {isSubmittingBatch ? 'Adding Items...' : 'Add All Items'}
          </Button>
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
              id="addItemName"
              required 
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
            <select 
              name="category"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
                <option value="Gear">Gear</option>
                <option value="Clothing">Clothing</option>
                <option value="Feeding">Feeding</option>
                <option value="Nursery">Nursery</option>
                <option value="Toys">Toys</option>
                <option value="Other">Other</option>
              </select>
            </div>
          <div className="flex items-center gap-2">
            <input 
              name="isGroupGifting" 
              type="checkbox"
              id="isGroupGifting"
              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isGroupGifting" className="text-sm font-medium text-stone-700">
              Enable Group Gifting (for big items)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              name="isMustHave" 
              type="checkbox"
              id="isMustHave"
              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isMustHave" className="text-sm font-medium text-stone-700">
              Mark as "Must-Have" Item
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Link (URL)</label>
            <div className="flex gap-2">
              <input 
                name="url" 
                id="addItemUrl"
                type="url"
                className="flex-1 rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="https://..."
                onBlur={async (e) => {
                  if (e.target.value) {
                    const nameInput = document.getElementById('addItemName') as HTMLInputElement;
                    if (!nameInput?.value) {
                      const { images, title } = await fetchItemMetadata(e.target.value);
                      setFetchedImages(images);
                      if (images.length > 0) setSelectedImageUrl(images[0]);
                      if (nameInput && title && !nameInput.value) {
                        nameInput.value = title;
                      }
                    }
                  }
                }}
              />
              <Button 
                type="button" 
                variant="secondary"
                onClick={async () => {
                  const urlInput = document.getElementById('addItemUrl') as HTMLInputElement;
                  if (urlInput?.value) {
                    const { images, title } = await fetchItemMetadata(urlInput.value);
                    setFetchedImages(images);
                    if (images.length > 0) setSelectedImageUrl(images[0]);
                    
                    const nameInput = document.getElementById('addItemName') as HTMLInputElement;
                    if (nameInput && title && !nameInput.value) {
                      nameInput.value = title;
                    }
                  }
                }}
                disabled={isFetchingMetadata}
              >
                {isFetchingMetadata ? '...' : 'Fetch'}
              </Button>
            </div>
          </div>

          {fetchMetadataError && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
              {fetchMetadataError}
            </div>
          )}

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

          {(!fetchedImages || fetchedImages.length === 0) && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Image (Optional)</label>
              <div className="flex gap-2">
                <input 
                  name="imageUrl" 
                  type="url"
                  value={selectedImageUrl || ''}
                  onChange={(e) => setSelectedImageUrl(e.target.value)}
                  className="flex-1 rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={2}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                id="editItemName"
                required 
                defaultValue={editingItem.name}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select 
                name="category"
                defaultValue={editingItem.category}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                  <option value="Gear">Gear</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Feeding">Feeding</option>
                  <option value="Nursery">Nursery</option>
                  <option value="Toys">Toys</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            <div className="flex items-center gap-2">
              <input 
                name="isGroupGifting" 
                type="checkbox"
                id="editIsGroupGifting"
                defaultChecked={editingItem.isGroupGifting}
                className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="editIsGroupGifting" className="text-sm font-medium text-stone-700">
                Enable Group Gifting (for big items)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                name="isMustHave" 
                type="checkbox"
                id="editIsMustHave"
                defaultChecked={editingItem.isMustHave}
                className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="editIsMustHave" className="text-sm font-medium text-stone-700">
                Mark as "Must-Have" Item
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Link (URL)</label>
              <div className="flex gap-2">
                <input 
                  name="url" 
                  id="editItemUrl"
                  type="url"
                  defaultValue={editingItem.url}
                  className="flex-1 rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="https://..."
                  onBlur={async (e) => {
                    if (e.target.value) {
                      const nameInput = document.getElementById('editItemName') as HTMLInputElement;
                      if (!nameInput?.value) {
                        const { images, title } = await fetchItemMetadata(e.target.value);
                        setFetchedImages(images);
                        if (images.length > 0) setSelectedImageUrl(images[0]);
                        if (nameInput && title && !nameInput.value) {
                          nameInput.value = title;
                        }
                      }
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={async () => {
                    const urlInput = document.getElementById('editItemUrl') as HTMLInputElement;
                    if (urlInput?.value) {
                      const { images, title } = await fetchItemMetadata(urlInput.value);
                      setFetchedImages(images);
                      if (images.length > 0) setSelectedImageUrl(images[0]);
                      
                      const nameInput = document.getElementById('editItemName') as HTMLInputElement;
                      if (nameInput && title && !nameInput.value) {
                        nameInput.value = title;
                      }
                    }
                  }}
                  disabled={isFetchingMetadata}
                >
                  {isFetchingMetadata ? '...' : 'Fetch'}
                </Button>
              </div>
            </div>

            {fetchMetadataError && (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                {fetchMetadataError}
              </div>
            )}

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

            {(!fetchedImages || fetchedImages.length === 0) && !editingItem.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Image (Optional)</label>
                <div className="flex gap-2">
                  <input 
                    name="imageUrl" 
                    type="url"
                    value={selectedImageUrl || ''}
                    onChange={(e) => setSelectedImageUrl(e.target.value)}
                    className="flex-1 rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
              <textarea 
                name="description" 
                rows={2}
                defaultValue={editingItem.description}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
        isOpen={isSizeGuideModalOpen} 
        onClose={() => setIsSizeGuideModalOpen(false)} 
        title="Baby Clothing Size Guide"
      >
        {selectedRegistry && selectedRegistry.dueDate && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 mb-4">
              Based on the expected due date ({new Date(selectedRegistry.dueDate).toLocaleDateString()}) and location ({selectedRegistry.hemisphere === 'northern' ? 'Northern' : 'Southern'} Hemisphere), here is a guide for what size clothes the baby will likely wear in each season.
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 text-stone-700 font-medium border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3">Months</th>
                    <th className="px-4 py-3">Season</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {generateSizeGuide(selectedRegistry.dueDate, selectedRegistry.hemisphere).map((guide, idx) => (
                    <tr key={idx} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-900">{guide.size}</td>
                      <td className="px-4 py-3 text-stone-600">{guide.age}</td>
                      <td className="px-4 py-3 text-stone-600">{guide.months}</td>
                      <td className="px-4 py-3 text-stone-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-medium">
                          {guide.seasons}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="e.g. Baby Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
              <input 
                name="dueDate" 
                type="date"
                defaultValue={selectedRegistry.dueDate}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
              <textarea 
                name="description" 
                rows={3}
                defaultValue={selectedRegistry.description}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="A little bit about your registry..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Welcome Message (Optional)</label>
              <textarea 
                name="welcomeMessage" 
                rows={2}
                defaultValue={selectedRegistry.welcomeMessage}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="A special note for your guests..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Currency</label>
                <select 
                  name="currency"
                  defaultValue={selectedRegistry.currency || 'USD'}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
                <select 
                  name="hemisphere"
                  defaultValue={selectedRegistry.hemisphere || 'southern'}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="northern">Northern Hemisphere</option>
                  <option value="southern">Southern Hemisphere</option>
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full py-3">Save Settings</Button>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isManageOwnersModalOpen}
        onClose={() => setIsManageOwnersModalOpen(false)}
        title="Manage Registry Owners"
      >
        {selectedRegistry && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-stone-900 mb-3">Current Owners</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-medium text-sm">
                      {selectedRegistry.ownerId.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">Primary Owner</p>
                      <p className="text-xs text-stone-500">Creator of this registry</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Primary</span>
                </div>
                
                {selectedRegistry.coOwnerEmails?.map((email) => (
                  <div key={email} className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-medium text-sm">
                        {email.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-stone-900">{email}</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveOwner(email)}
                      className="text-stone-400 hover:text-red-500 transition-colors p-1"
                      title="Remove owner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <h4 className="text-sm font-medium text-stone-900 mb-3">Add Co-Owner</h4>
              <form onSubmit={handleAddOwner} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 rounded-xl border border-stone-200 px-4 py-2 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                />
                <Button type="submit" disabled={!newOwnerEmail.trim()}>
                  Add
                </Button>
              </form>
              <p className="text-xs text-stone-500 mt-2">
                Co-owners can add, edit, and manage items, as well as view the thank you tracker.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title={claimMode === 'claim' ? 'Claim Item' : 'Reserve Item'}
      >
        <form onSubmit={handleClaim} className="space-y-4">
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-4">
            {claimingItem?.imageUrl ? (
              <img src={claimingItem.imageUrl} alt={claimingItem.name} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <CategoryPlaceholder category={claimingItem?.category} name={claimingItem?.name || ''} className="w-16 h-16 rounded-xl" />
            )}
            <div>
              <h4 className="font-bold text-stone-900">{claimingItem?.name}</h4>
              <p className="text-sm text-stone-500 line-clamp-1">{claimingItem?.description}</p>
              {claimingItem && claimingItem.quantity > 1 && (
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-emerald-600">
                  <Package className="w-3 h-3" />
                  <span>{claimingItem.quantity - (claimingItem.quantityClaimed || 0) - (claimingItem.quantityReserved || 0)} remaining of {claimingItem.quantity}</span>
                </div>
              )}
            </div>
          </div>

          {claimingItem && claimingItem.quantity > 1 && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                How many are you {claimMode === 'claim' ? 'claiming' : 'reserving'}?
              </label>
              <input
                type="number"
                name="quantity"
                min={1}
                max={claimingItem.quantity - (claimingItem.quantityClaimed || 0) - (claimingItem.quantityReserved || 0)}
                defaultValue={1}
                required
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Leave a message for the parents (optional)
            </label>
            <textarea
              name="guestMessage"
              rows={3}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder="Congratulations! We're so excited for you..."
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {claimMode === 'claim' 
                ? "By claiming this item, you're letting others know you've already purchased it or intend to do so immediately."
                : "Reserving an item holds it for 48 hours, giving you time to complete your purchase."}
            </p>
          </div>

          <Button type="submit" className="w-full py-3">
            {claimMode === 'claim' ? 'Confirm Claim' : 'Confirm Reservation'}
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        title="Contribute to Group Gift"
      >
        {contributingItem && (
          <form onSubmit={handleContribute} className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-4">
              {contributingItem.imageUrl ? (
                <img src={contributingItem.imageUrl} alt={contributingItem.name} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <CategoryPlaceholder category={contributingItem.category} name={contributingItem.name} className="w-16 h-16 rounded-xl" />
              )}
              <div className="flex-1">
                <h4 className="font-bold text-stone-900">{contributingItem.name}</h4>
                <div className="flex justify-between text-xs text-stone-500 mt-1">
                  <span>Target: {getCurrencySymbol(selectedRegistry?.currency)}{contributingItem.price}</span>
                  <span>Remaining: {getCurrencySymbol(selectedRegistry?.currency)}{(contributingItem.price || 0) - (contributingItem.amountContributed || 0)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Contribution Amount ({getCurrencySymbol(selectedRegistry?.currency)})
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(contributingItem.price || 0) - (contributingItem.amountContributed || 0)}
                required
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Leave a message (optional)
              </label>
              <textarea
                name="message"
                rows={3}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="We're so happy to contribute to this gift!..."
              />
            </div>

            <Button type="submit" className="w-full py-3">
              Confirm Contribution
            </Button>
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
