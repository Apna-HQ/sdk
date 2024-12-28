"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ApnaApp } from "..";

const ApnaContext = createContext<ApnaApp | null>(null);

export const useApna = () => {
  const context = useContext(ApnaContext);
  if (!context) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return context;
};

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [apna, setApna] = useState<ApnaApp>();

  useEffect(() => {
    console.log("before init")
    const init = async () => {
      console.log("inside init")
      if (!apna) {
        const { ApnaApp } = await import("..");
        const apna = new ApnaApp({ appId: "apna-nostr-mvp-1" });
        setApna(apna);
      } else {
      console.log(
        "nostr.getProfile return value: ",
        await apna.nostr.getProfile()
      );
    }
    };
    init();
  }, []);

  return (
    <ApnaContext.Provider value={apna || null}>{children}</ApnaContext.Provider>
  );
}
