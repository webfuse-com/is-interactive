import { checkInteractivity } from "./check-interactivity.js";
import { filterInteractive } from "./filter-interactive.js";
declare global {
    interface Window {
        IsInteractive: {
            checkInteractivity: typeof checkInteractivity;
            filterInteractive: typeof filterInteractive;
        };
    }
}
