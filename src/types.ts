export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role?: 'parent' | 'guest';
}

export interface Registry {
  id: string;
  babyName: string;
  dueDate: string;
  description: string;
  welcomeMessage?: string;
  ownerId: string;
  coOwnerEmails?: string[];
  createdAt: any;
  currency?: string;
  hemisphere?: 'northern' | 'southern';
}

export interface GuestBookEntry {
  id: string;
  registryId: string;
  authorName: string;
  message: string;
  createdAt: any;
  authorId?: string;
}

export interface RegistryItem {
  id: string;
  registryId: string;
  name: string;
  description: string;
  price?: number;
  url: string;
  imageUrl?: string;
  category: string;
  status: 'available' | 'claimed' | 'reserved';
  quantity: number;
  quantityClaimed?: number;
  quantityReserved?: number;
  isMustHave?: boolean;
  claims?: { 
    uid: string; 
    email: string; 
    userName: string; 
    quantity: number; 
    message?: string; 
    status: 'claimed' | 'reserved';
    createdAt: any;
    reservedUntil?: any;
    thankYouSent?: boolean;
  }[];
  claimedBy?: string;
  claimedByEmail?: string;
  claimedAt?: any;
  guestMessage?: string;
  thankYouSent?: boolean;
  isGroupGifting?: boolean;
  amountContributed?: number;
  contributions?: { uid: string; email: string; userName: string; amount: number; message?: string; createdAt: any; thankYouSent?: boolean }[];
  reservedUntil?: any;
  addedBy: string;
  createdAt?: any;
}

export interface Notification {
  id: string;
  userId: string;
  registryId: string;
  itemId?: string;
  itemName?: string;
  type: 'claim' | 'reserve' | 'contribution';
  message: string;
  guestName: string;
  guestEmail: string;
  read: boolean;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
