"use client";

import { useCallback } from "react";
import { useModal } from "connectkit";

export function useConnectWalletClick() {
  const { setOpen } = useModal();

  return useCallback(() => {
    setOpen(true);
  }, [setOpen]);
}
