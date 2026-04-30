import { isInteractive } from "./is-interactive.js";
declare global {
    interface Window {
        isInteractive: typeof isInteractive;
    }
}
