// App.tsx: redirect using only AppKit account state
import { useAppKitAccount } from "@reown/appkit/react";
function ConnectionWatcher() {
  const { isConnected } = useAppKitAccount();
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    if (isConnected && loc.pathname !== "/dashboard") nav("/dashboard", { replace: true });
    if (!isConnected && loc.pathname !== "/") nav("/", { replace: true });
  }, [isConnected, loc.pathname, nav]);

  return null;
}
