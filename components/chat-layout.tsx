import { ChevronDown } from "lucide-react";
import { ViewTransition } from "react";
import AuthDialog from "@/components/auth-dialog";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import type { AuthDialogState } from "@/hooks/use-auth-retry";
import type { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";

const ChatLayout = ({
  scroll,
  authDialog,
  children,
  bottomBar,
}: {
  scroll: ReturnType<typeof useScrollToBottom>;
  authDialog: AuthDialogState;
  children: React.ReactNode;
  bottomBar: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col h-screen">
      <div
        ref={scroll.chatListRef}
        className="overflow-y-auto scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent px-2"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        {children}
      </div>

      <div className="mt-auto pb-1 space-y-1 absolute bottom-0 left-0 right-0 bg-linear-to-t from-background to-transparent px-2">
        {scroll.showToBottom && (
          <ViewTransition>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shadow-xl absolute left-1/2 -translate-x-1/2 -top-10 z-10"
              onClick={scroll.scrollToBottom}
            >
              <ChevronDown />
            </Button>
          </ViewTransition>
        )}

        {bottomBar}
        <Footer />
      </div>

      <AuthDialog {...authDialog} />
    </div>
  );
};

export default ChatLayout;
