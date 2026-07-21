import { source } from "sveltekit-sse";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("notifications");

export type Notification = {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: "movie" | "show" | "season" | "episode";
    year?: number;
    duration?: number;
    imdb_id?: string;
    read: boolean;
};

type NotificationEvent = {
    title: string;
    log_string: string;
    timestamp: string;
    type: "movie" | "show" | "season" | "episode";
    year?: number;
    duration?: number;
    imdb_id?: string;
};

export class NotificationStore {
    #notifications = $state<Notification[]>([]);
    #connectionStatus = $state<"connecting" | "connected" | "disconnected" | "error">(
        "disconnected"
    );
    #connection: ReturnType<typeof source> | null = null;
    #unsubscribe: (() => void) | null = null;

    // Callback for when a new notification is added (for toast display)
    onNotificationAdded: ((notification: Notification) => void) | null = null;

    #isNotificationEvent(value: unknown): value is NotificationEvent {
        if (!value || typeof value !== "object") {
            return false;
        }

        const event = value as Partial<NotificationEvent>;
        return (
            typeof event.title === "string" &&
            typeof event.log_string === "string" &&
            typeof event.timestamp === "string" &&
            (event.type === "movie" ||
                event.type === "show" ||
                event.type === "season" ||
                event.type === "episode") &&
            (event.year === undefined || typeof event.year === "number") &&
            (event.duration === undefined || typeof event.duration === "number") &&
            (event.imdb_id === undefined || typeof event.imdb_id === "string")
        );
    }

    get notifications() {
        return this.#notifications;
    }

    get unreadCount() {
        return this.#notifications.filter((n) => !n.read).length;
    }

    get connectionStatus() {
        return this.#connectionStatus;
    }

    add(notification: Omit<Notification, "id" | "read">) {
        const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            read: false
        };
        this.#notifications = [newNotification, ...this.#notifications];

        // Trigger callback for toast notification
        this.onNotificationAdded?.(newNotification);
    }

    markAsRead(id: string) {
        const notification = this.#notifications.find((n) => n.id === id);
        if (notification) {
            notification.read = true;
        }
    }

    markAllAsRead() {
        this.#notifications.forEach((n) => (n.read = true));
    }

    clear() {
        this.#notifications = [];
    }

    remove(id: string) {
        this.#notifications = this.#notifications.filter((n) => n.id !== id);
    }

    #handleNotificationEvent(data: NotificationEvent) {
        const message =
            data.type === "movie"
                ? `${data.log_string} (${data.year || "Unknown"}) completed`
                : `${data.log_string} completed`;

        this.add({
            title: data.title,
            message,
            timestamp: data.timestamp,
            type: data.type,
            year: data.year,
            duration: data.duration,
            imdb_id: data.imdb_id
        });
    }

    connect() {
        if (this.#connection) {
            return;
        }

        this.#connectionStatus = "connecting";

        try {
            this.#connection = source("/api/notifications", {
                open: () => {
                    this.#connectionStatus = "connected";
                    logger.info("Notification stream connected");
                },
                close: ({ connect }) => {
                    if (this.#connectionStatus !== "disconnected") {
                        this.#connectionStatus = "error";
                        logger.info("Notification stream closed, reconnecting...");
                        // Auto-reconnect
                        setTimeout(() => {
                            try {
                                if (this.#connectionStatus !== "disconnected") {
                                    connect();
                                }
                            } catch (e) {
                                logger.error("Notification reconnect failed:", e);
                            }
                        }, 1000);
                    }
                },
                error: (error) => {
                    logger.error("Notification stream error:", error);
                    this.#connectionStatus = "error";
                }
            });

            const notificationValue = this.#connection
                .select("notification")
                .json<NotificationEvent | null>(({ error }) => {
                    if (error) {
                        if (
                            error instanceof SyntaxError &&
                            error.message.includes("Unexpected end of JSON input")
                        ) {
                            return null;
                        }
                        logger.warn("Failed to parse notification payload", error);
                        return null;
                    }
                    return null;
                });

            this.#unsubscribe = notificationValue.subscribe((value) => {
                try {
                    if (value == null) return;

                    if (!this.#isNotificationEvent(value)) {
                        logger.warn("Ignoring invalid notification payload", value);
                        return;
                    }

                    this.#handleNotificationEvent(value);
                } catch (e) {
                    logger.error("Failed to handle notification event:", e);
                }
            });
        } catch (e) {
            logger.error("Failed to establish notification connection:", e);
            this.#connectionStatus = "error";
        }
    }

    disconnect() {
        this.#connectionStatus = "disconnected";
        if (this.#unsubscribe) {
            this.#unsubscribe();
            this.#unsubscribe = null;
        }
        if (this.#connection) {
            this.#connection.close();
            this.#connection = null;
        }
    }

    reconnect() {
        this.disconnect();
        this.connect();
    }
}

export const notificationStore = new NotificationStore();
