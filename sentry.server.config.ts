import * as Sentry from "@sentry/nextjs";

import { SENTRY_SERVER_OPTIONS } from "./sentry.shared.config";

Sentry.init(SENTRY_SERVER_OPTIONS);
