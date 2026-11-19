import type messages from "../messages/en.json";

// Message keys are checked at compile time against the English catalogue
// (the i18n catalogue test keeps the Polish one in sync).
declare module "next-intl" {
  // eslint-disable-next-line typescript/consistent-type-definitions -- module augmentation merges only into an interface
  interface AppConfig {
    Messages: typeof messages;
  }
}
