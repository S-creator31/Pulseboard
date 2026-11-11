'use client';

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';



const AuthContext = createContext();


export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(typeof window !== 'undefined'){

      // localStorage is shared by every tab for this origin. Keeping auth in
      // sessionStorage isolates simultaneous accounts in separate tabs/windows.
      const storedUser = sessionStorage.getItem('user');

      if(storedUser) {
        try{
          const userData = JSON.parse(storedUser);
          
          setUser(userData);
        }catch(err){
          console.error('Error parsing user from session storage')
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('token');
          setUser(null)

        }
      }
      // Remove credentials left by older builds; they are shared across tabs.
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setLoading(false);
    }
  }, []);


  const login = async (email, password) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const decoded = jwtDecode(data.token);
      const userId = decoded.id;

      const userObj = {
        token: data.token,
        id: userId,
        _id: userId
      };

      sessionStorage.setItem('user', JSON.stringify(userObj));

      sessionStorage.setItem('token', data.token);
      // setUser({ token: data.token, id: userId });
      setUser(userObj)

      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err.message);
      throw err;
    }
  };


  const logout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
