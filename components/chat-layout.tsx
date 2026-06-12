import { ChevronDown } from "lucide-react";
import { type RefObject, ViewTransition } from "react";
import AuthDialog from "@/components/auth-dialog";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";

const ChatLayout = ({
  chatListRef,
  showToBottom,
  scrollToBottom,
  authDialogOpen,
  setAuthDialogOpen,
  children,
  bottomBar,
}: {
  chatListRef: RefObject<HTMLDivElement | null>;
  showToBottom: boolean;
  scrollToBottom: () => void;
  authDialogOpen: boolean;
  setAuthDialogOpen: (open: boolean) => void;
  children: React.ReactNode;
  bottomBar: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col h-screen">
      <div
        ref={chatListRef}
        className="overflow-y-auto scrollbar px-2"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        {children}
      </div>

      <div className="mt-auto pb-1 space-y-1 absolute bottom-0 left-0 right-0 bg-linear-to-t from-background to-transparent px-2">
        {showToBottom && (
          <ViewTransition>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shadow-xl absolute left-1/2 -translate-x-1/2 -top-10 z-10"
              onClick={scrollToBottom}
            >
              <ChevronDown />
            </Button>
          </ViewTransition>
        )}

        {bottomBar}
        <Footer />
      </div>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};

export default ChatLayout;
