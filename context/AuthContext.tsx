"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => ReturnType<typeof signInWithEmailAndPassword>;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, firstName: string, lastName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const createdUser = userCredential.user;
    
    // Write extra user profile info to Firestore
    await setDoc(doc(db, "users", createdUser.uid), {
      email,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    });

    return createdUser;
  };

  const logout = () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
}
