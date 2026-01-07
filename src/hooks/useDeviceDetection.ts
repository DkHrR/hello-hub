import { useState, useEffect, useCallback } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape';
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenWidth: number;
  screenHeight: number;
  hasCamera: boolean;
  hasMicrophone: boolean;
  isHighPerformance: boolean;
  pixelRatio: number;
  prefersReducedMotion: boolean;
  isOnline: boolean;
}

const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      setDeviceInfo(getDeviceInfo());
    };

    const handleOnlineChange = () => {
      setDeviceInfo(prev => ({ ...prev, isOnline: navigator.onLine }));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    // Check for camera/microphone availability
    checkMediaDevices().then(({ hasCamera, hasMicrophone }) => {
      setDeviceInfo(prev => ({ ...prev, hasCamera, hasMicrophone }));
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, []);

  return deviceInfo;
}

function getDeviceInfo(): DeviceInfo {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const height = typeof window !== 'undefined' ? window.innerHeight : 768;
  
  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;
  
  const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0
  );

  const orientation: 'portrait' | 'landscape' = height > width ? 'portrait' : 'landscape';
  
  const deviceType: 'mobile' | 'tablet' | 'desktop' = 
    isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
  // Check for high performance device (basic heuristic)
  const isHighPerformance = typeof navigator !== 'undefined' && 
    (navigator.hardwareConcurrency || 1) >= 4 && 
    pixelRatio >= 2;

  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    orientation,
    deviceType,
    screenWidth: width,
    screenHeight: height,
    hasCamera: false, // Will be updated async
    hasMicrophone: false, // Will be updated async
    isHighPerformance,
    pixelRatio,
    prefersReducedMotion,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
}

async function checkMediaDevices(): Promise<{ hasCamera: boolean; hasMicrophone: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { hasCamera: false, hasMicrophone: false };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      hasCamera: devices.some(device => device.kind === 'videoinput'),
      hasMicrophone: devices.some(device => device.kind === 'audioinput'),
    };
  } catch {
    return { hasCamera: false, hasMicrophone: false };
  }
}

// Utility hook for conditional rendering based on device
export function useResponsive() {
  const device = useDeviceDetection();
  
  const isMobileOrTablet = device.isMobile || device.isTablet;
  const isPortrait = device.orientation === 'portrait';
  
  return {
    ...device,
    isMobileOrTablet,
    isPortrait,
    isLandscape: !isPortrait,
  };
}
