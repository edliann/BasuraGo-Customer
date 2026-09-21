export type UserRole =
  | 'customer'
  | 'rider'
  | 'admin';

export type AccountStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'disabled';

export interface AppUser {
  id: string;
  role: UserRole;
  status: AccountStatus;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  status: AccountStatus;
  defaultAddressId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  onboardingCompleted: boolean;
  status: AccountStatus;
  defaultAddressId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}