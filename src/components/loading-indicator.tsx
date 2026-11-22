import { useRouterState } from "@tanstack/react-router";
import { Spinner } from "@/components/ui/spinner";

/** Shows a spinner while the router is navigating to `pathname`. */
const LoadingIndicator = ({ pathname, className }: { pathname: string; className?: string }) => {
  const pending = useRouterState({
    select: (state) => state.status === "pending" && state.location.pathname === pathname,
  });

  if (pending) {
    return <Spinner className={className} />;
  }
};

export default LoadingIndicator;
