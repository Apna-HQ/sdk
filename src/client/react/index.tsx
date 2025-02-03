"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ApnaApp } from "..";

let apna: ApnaApp;

interface NostrContextType {
  nostr: any;
}

const NostrContext = createContext<NostrContextType | null>(null);

export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return context;
};

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [nostr, setNostr] = useState<any>();

  useEffect(() => {
    const init = async () => {
      if (!apna) {
        const { ApnaApp } = await import("..");
        apna = new ApnaApp({ appId: "apna-nostr-mvp-1" });
        setNostr(apna.nostr);
      }
      console.log(
        "nostr.getProfile return value: ",
        await apna.nostr.getActiveUserProfile()
      );
    };
    init();
  }, []);

  return (
    <NostrContext.Provider value={{ nostr }}>{children}</NostrContext.Provider>
  );
}
