import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { firebaseAuth } from '@/services/firebase';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseUser | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        setFirebaseUser(user);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Firebase auth state error:',
          error,
        );

        setFirebaseUser(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider',
    );
  }

  return context;
}