import { debounce } from "next/dist/server/utils";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const useScrollToBottom = () => {
  const chatListRef = useRef<HTMLDivElement>(null);
  const [showToBottom, setShowToBottom] = useState(false);

  const scrollToBottom = useCallback(
    (behavior: "smooth" | "instant" = "smooth") => {
      chatListRef.current?.scrollTo({
        top: chatListRef.current.scrollHeight,
        behavior,
      });
    },
    [],
  );

  useEffect(() => {
    const onScroll = debounce(() => {
      if (chatListRef.current) {
        if (
          chatListRef.current.scrollTop + chatListRef.current.clientHeight <
          chatListRef.current.scrollHeight - 100
        ) {
          startTransition(() => setShowToBottom(true));
        } else {
          startTransition(() => setShowToBottom(false));
        }
      }
    }, 100);
    chatListRef.current?.addEventListener("scroll", onScroll);

    return () => chatListRef.current?.removeEventListener("scroll", onScroll);
  }, []);

  return { chatListRef, showToBottom, scrollToBottom };
};
