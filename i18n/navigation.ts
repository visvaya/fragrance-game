import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Kept apart from routing.ts: on the server, createNavigation loads the request config
// (i18n/request.ts, which reads next/root-params), and the proxy imports routing.ts but cannot
// bundle next/root-params.
export const { usePathname, useRouter } = createNavigation(routing);
