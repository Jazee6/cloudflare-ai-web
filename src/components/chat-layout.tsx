import AuthDialog from "@/components/auth-dialog";
import Footer from "@/components/footer";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { AuthDialogState } from "@/hooks/use-auth-retry";

const ChatLayout = ({
  authDialog,
  children,
  bottomBar,
}: {
  authDialog: AuthDialogState;
  children: React.ReactNode;
  bottomBar: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col h-screen">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="px-2">{children}</MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="flex flex-col gap-1 px-2 pb-1">
        {bottomBar}
        <Footer />
      </div>

      <AuthDialog {...authDialog} />
    </div>
  );
};

export default ChatLayout;
