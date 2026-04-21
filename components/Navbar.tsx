'use client';

// src/components/Navbar.tsx
import { useEffect, useState } from 'react';
import { UserCircle } from "lucide-react";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.email === 'ali@gmail.com') {
          setUserRole('Super Admin');
          setCompanyName('Ryu Media'); // Or some default for super admin
        } else {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0].data();
            setUserRole(userDoc.role || 'Staff');
            if (userDoc.companyId) {
              const companyDoc = await getDoc(doc(db, "companies", userDoc.companyId));
              if (companyDoc.exists()) {
                setCompanyName(companyDoc.data().name);
              }
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
       <div>
        <h2 className="font-bold text-xl text-gray-800">{companyName}</h2>
      </div>
      {/* User Menu */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <UserCircle size={32} className="text-gray-500" />
          <div>
            <p className="font-semibold text-sm">
              {userRole}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
