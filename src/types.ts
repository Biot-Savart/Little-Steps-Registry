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
  ownerId: string;
  createdAt: any;
  currency?: string;
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
  claimedBy?: string;
  claimedAt?: any;
  addedBy: string;
  createdAt?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
