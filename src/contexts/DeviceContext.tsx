import React, { createContext, useContext, ReactNode } from 'react';
import { useDeviceDetection, DeviceInfo } from '@/hooks/useDeviceDetection';

const DeviceContext = createContext<DeviceInfo | null>(null);

interface DeviceProviderProps {
  children: ReactNode;
}

export function DeviceProvider({ children }: DeviceProviderProps) {
  const deviceInfo = useDeviceDetection();
  
  return (
    <DeviceContext.Provider value={deviceInfo}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceInfo {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
export function useDeviceOptional(): DeviceInfo | null {
  return useContext(DeviceContext);
}
