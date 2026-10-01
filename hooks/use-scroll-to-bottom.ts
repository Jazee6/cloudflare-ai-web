import { startTransition, useCallback, useEffect, useRef, useState } from "react";

const FOLLOW_THRESHOLD_PX = 250;

const debounce = (callback: () => void, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    run: () => {
      clearTimeout(timer);
      timer = setTimeout(callback, delay);
    },
    cancel: () => clearTimeout(timer),
  };
};

export const useScrollToBottom = () => {
  const chatListRef = useRef<HTMLDivElement>(null);
  const [showToBottom, setShowToBottom] = useState(false);

  const scrollToBottom = useCallback(() => {
    chatListRef.current?.scrollTo({
      top: chatListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  /** Keeps streaming output in view unless the reader has scrolled away from the bottom. */
  const followIfNearBottom = useCallback(() => {
    const list = chatListRef.current;
    if (list && list.scrollHeight - list.scrollTop - list.clientHeight < FOLLOW_THRESHOLD_PX) {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  useEffect(() => {
    const debouncedScroll = debounce(() => {
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
    const scrollContainer = chatListRef.current;
    scrollContainer?.addEventListener("scroll", debouncedScroll.run);

    return () => {
      debouncedScroll.cancel();
      scrollContainer?.removeEventListener("scroll", debouncedScroll.run);
    };
  }, []);

  return { chatListRef, showToBottom, scrollToBottom, followIfNearBottom };
};
