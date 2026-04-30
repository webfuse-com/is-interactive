import { checkInteractivity } from "./is-interactive.js";
declare global {
    interface Window {
        checkInteractivity: typeof checkInteractivity;
    }
}
