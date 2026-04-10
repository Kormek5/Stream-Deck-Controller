import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface ProfileContextType {
  selectedProfileId: number | null;
  setSelectedProfileId: (id: number) => void;
  currentFolderId: number | null;
  setCurrentFolderId: (id: number | null) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  selectedProfileId: null,
  setSelectedProfileId: () => {},
  currentFolderId: null,
  setCurrentFolderId: () => {},
});

const STORAGE_KEY = "streamdeck_selected_profile";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [selectedProfileId, setSelectedProfileIdState] = useState<number | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setSelectedProfileIdState(Number(val));
    });
  }, []);

  const setSelectedProfileId = (id: number) => {
    setSelectedProfileIdState(id);
    setCurrentFolderId(null);
    AsyncStorage.setItem(STORAGE_KEY, String(id));
  };

  return (
    <ProfileContext.Provider
      value={{ selectedProfileId, setSelectedProfileId, currentFolderId, setCurrentFolderId }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
