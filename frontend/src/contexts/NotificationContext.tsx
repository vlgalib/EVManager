import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification from '../components/Notification';
import { useLanguage } from './LanguageContext';

interface NotificationData {
  id: string;
  message: string;
  messageKey?: string;
  params?: Record<string, string>;
  type: 'success' | 'error' | 'info';
  autoHide?: boolean;
  autoHideDelay?: number;
}

interface NotificationContextType {
  showNotification: (message: string, type: 'success' | 'error' | 'info', autoHide?: boolean, autoHideDelay?: number) => void;
  showNotificationWithKey: (messageKey: string, message: string, type: 'success' | 'error' | 'info', params?: Record<string, string>, autoHide?: boolean, autoHideDelay?: number) => void;
  hideNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const { t } = useLanguage();

  const showNotification = (
    message: string, 
    type: 'success' | 'error' | 'info', 
    autoHide: boolean = true,
    autoHideDelay: number = 5000
  ) => {
    const id = Date.now().toString();
    const newNotification: NotificationData = {
      id,
      message,
      type,
      autoHide,
      autoHideDelay,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 3)); // Максимум 3 уведомления
  };

  const showNotificationWithKey = (
    messageKey: string,
    message: string, 
    type: 'success' | 'error' | 'info',
    params?: Record<string, string>,
    autoHide: boolean = true,
    autoHideDelay: number = 5000
  ) => {
    const id = Date.now().toString();
    const newNotification: NotificationData = {
      id,
      message,
      messageKey,
      params,
      type,
      autoHide,
      autoHideDelay,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 3)); // Максимум 3 уведомления
  };

  const hideNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showNotificationWithKey, hideNotification }}>
      {children}
      
      {/* Render notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{ 
              transform: `translateY(${index * 4}px)`,
              zIndex: 1000 - index 
            }}
          >
            <Notification
              message={notification.messageKey ? t(notification.messageKey, notification.params) : notification.message}
              type={notification.type}
              isVisible={true}
              onClose={() => hideNotification(notification.id)}
              autoHide={notification.autoHide}
              autoHideDelay={notification.autoHideDelay}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;