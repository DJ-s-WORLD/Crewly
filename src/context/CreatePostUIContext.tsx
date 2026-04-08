import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import CreatePostModal from "@/components/CreatePostModal";

type Ctx = {
  openCreatePost: () => void;
  closeCreatePost: () => void;
  isOpen: boolean;
};

const CreatePostUIContext = createContext<Ctx | undefined>(undefined);

export function CreatePostUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openCreatePost = useCallback(() => setOpen(true), []);
  const closeCreatePost = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      openCreatePost,
      closeCreatePost,
      isOpen: open,
    }),
    [open, openCreatePost, closeCreatePost]
  );

  return (
    <CreatePostUIContext.Provider value={value}>
      {children}
      <CreatePostModal open={open} onOpenChange={setOpen} />
    </CreatePostUIContext.Provider>
  );
}

export function useCreatePostUI() {
  const x = useContext(CreatePostUIContext);
  if (!x) throw new Error("useCreatePostUI must be used within CreatePostUIProvider");
  return x;
}
