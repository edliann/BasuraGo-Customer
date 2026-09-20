import type { User } from 'firebase/auth';

import { createCustomerProfile } from '@/services/customer';

export async function provisionCustomer(
  user: User,
) {
  const fullName =
    user.displayName?.trim() ||
    'BasuraGo Customer';

  const email =
    user.email?.trim().toLowerCase() || '';

  await createCustomerProfile({
    userId: user.uid,
    fullName,
    email,
  });

  return user;
}