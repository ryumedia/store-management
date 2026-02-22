'use client';

// src/components/Navbar.tsx
import { useEffect, useState } from 'react';
import { UserCircle } from "lucide-react";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="bg-white shadow-sm p-4 flex justify-end items-center">
      {/* User Menu */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <UserCircle size={32} className="text-gray-500" />
          <div>
            <p className="font-semibold text-sm">
              {user?.email === 'ali@gmail.com' ? 'Super Admin' : (user?.displayName || 'Staff')}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
