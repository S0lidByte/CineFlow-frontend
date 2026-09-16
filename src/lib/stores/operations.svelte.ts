import { source } from "sveltekit-sse";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";
import type { components } from "$lib/providers/riven";

const logger = createScopedLogger("operations-store");

export type OperationItem = components["schemas"]["OperationTimelineItem"];

export class OperationsStore {
    #items = $state<OperationItem[]>([]);
    #total = $state<number>(0);
    #isLoading = $state<boolean>(false);
    #error = $state<string | null>(null);
    #selectedStatus = $state<string | null>(null);
    #selectedType = $state<string | null>(null);
    #searchCorrelationId = $state<string>("");
    #connectionStatus = $state<"connecting" | "connected" | "disconnected" | "error">(
        "disconnected"
    );
    #connection: ReturnType<typeof source> | null = null;
    #unsubscribe: (() => void) | null = null;

    get items() {
        return this.#items;
    }

    get total() {
        return this.#total;
    }

    get isLoading() {
        return this.#isLoading;
    }

    get error() {
        return this.#error;
    }

    get selectedStatus() {
        return this.#selectedStatus;
    }

    set selectedStatus(val: string | null) {
        this.#selectedStatus = val;
        if (typeof window !== "undefined") {
            void this.fetchOperations();
        }
    }

    get selectedType() {
        return this.#selectedType;
    }

    set selectedType(val: string | null) {
        this.#selectedType = val;
        if (typeof window !== "undefined") {
            void this.fetchOperations();
        }
    }

    get searchCorrelationId() {
        return this.#searchCorrelationId;
    }

    set searchCorrelationId(val: string) {
        this.#searchCorrelationId = val;
    }

    get connectionStatus() {
        return this.#connectionStatus;
    }

    async fetchOperations(limit: number = 50, offset: number = 0) {
        try {
            this.#isLoading = true;
            this.#error = null;

            const query: Record<string, string | number> = {
                limit,
                offset
            };

            if (this.#selectedStatus) {
                query.status = this.#selectedStatus;
            }
            if (this.#selectedType) {
                query.operation_type = this.#selectedType;
            }
            if (this.#searchCorrelationId.trim()) {
                query.correlation_id = this.#searchCorrelationId.trim();
            }

            const response = await providers.riven.GET("/api/v1/operations/timeline", {
                params: {
                    query: query as never
                }
            });

            if (response.error) {
                const err =
                    typeof response.error === "object" &&
                    response.error !== null &&
                    "message" in response.error
                        ? String((response.error as { message: string }).message)
                        : JSON.stringify(response.error);
                throw new Error(err);
            }

            if (response.data) {
                this.#items = response.data.items || [];
                this.#total = response.data.total || 0;
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            logger.error("Failed to fetch operation timeline items:", e);
            this.#error = `Failed to fetch operations: ${message}`;
        } finally {
            this.#isLoading = false;
        }
    }

    async retryOperation(operationId: string): Promise<boolean> {
        try {
            const response = await providers.riven.POST(
                "/api/v1/operations/timeline/{operation_id}/retry",
                {
                    params: {
                        path: {
                            operation_id: operationId
                        }
                    }
                }
            );

            if (response.error) {
                const errObj = response.error as Record<string, unknown>;
                const err =
                    typeof response.error === "object" &&
                    response.error !== null &&
                    "detail" in errObj
                        ? typeof errObj.detail === "string"
                            ? errObj.detail
                            : JSON.stringify(errObj.detail)
                        : JSON.stringify(response.error);
                throw new Error(err);
            }

            if (response.data && response.data.operation) {
                this.upsertItem(response.data.operation);
            } else {
                await this.fetchOperations();
            }
            return true;
        } catch (e: unknown) {
            logger.error(`Failed to retry operation ${operationId}:`, e);
            throw e;
        }
    }

    /**
     * Synchronizes a single operation item (from SSE or REST) into the store with
     * canonical ID deduplication, stale event rejection, and filter enforcement.
     *
     * @returns true if the item was applied/upserted, false if ignored (e.g. invalid or stale).
     */
    upsertItem(newItem: OperationItem): boolean {
        if (!newItem || !newItem.id) {
            return false;
        }

        const existingIndex = this.#items.findIndex((item) => item.id === newItem.id);

        if (existingIndex >= 0) {
            const existingItem = this.#items[existingIndex];

            // Ordering / staleness check:
            // Compare updated_at timestamps if available
            const newTime = newItem.updated_at ? Date.parse(newItem.updated_at) : 0;
            const existingTime = existingItem.updated_at ? Date.parse(existingItem.updated_at) : 0;

            if (newTime > 0 && existingTime > 0 && newTime < existingTime) {
                // Reject late / out-of-order event with older timestamp
                logger.debug(
                    `Ignoring stale operation update for ${newItem.id} (new: ${newTime} < existing: ${existingTime})`
                );
                return false;
            }

            // If timestamps are equal, prevent terminal state regression to non-terminal state
            // unless attempt_count has increased (e.g., retried)
            if (
                newTime > 0 &&
                existingTime > 0 &&
                newTime === existingTime &&
                (existingItem.status === "completed" || existingItem.status === "failed") &&
                (newItem.status === "processing" || newItem.status === "pending") &&
                (newItem.attempt_count ?? 0) <= (existingItem.attempt_count ?? 0)
            ) {
                logger.debug(
                    `Ignoring regressive status transition for ${newItem.id} from ${existingItem.status} to ${newItem.status}`
                );
                return false;
            }

            const merged: OperationItem = {
                ...existingItem,
                ...newItem
            };

            const matchesStatus = !this.#selectedStatus || this.#selectedStatus === merged.status;
            const matchesType = !this.#selectedType || this.#selectedType === merged.operation_type;
            const matchesCorrelation =
                !this.#searchCorrelationId.trim() ||
                Boolean(
                    merged.correlation_id &&
                    merged.correlation_id
                        .toLowerCase()
                        .includes(this.#searchCorrelationId.trim().toLowerCase())
                );

            if (matchesStatus && matchesType && matchesCorrelation) {
                this.#items[existingIndex] = merged;
            } else {
                // Remove item from view if it no longer matches active filters
                this.#items.splice(existingIndex, 1);
                this.#total = Math.max(0, this.#total - 1);
            }
            return true;
        } else {
            const matchesStatus = !this.#selectedStatus || this.#selectedStatus === newItem.status;
            const matchesType =
                !this.#selectedType || this.#selectedType === newItem.operation_type;
            const matchesCorrelation =
                !this.#searchCorrelationId.trim() ||
                Boolean(
                    newItem.correlation_id &&
                    newItem.correlation_id
                        .toLowerCase()
                        .includes(this.#searchCorrelationId.trim().toLowerCase())
                );

            if (matchesStatus && matchesType && matchesCorrelation) {
                this.#items.unshift(newItem);
                this.#total += 1;
                return true;
            }
            return false;
        }
    }

    setItems(items: OperationItem[], total?: number) {
        this.#items = [...items];
        this.#total = total ?? items.length;
    }

    reset() {
        this.#items = [];
        this.#total = 0;
        this.#isLoading = false;
        this.#error = null;
        this.#selectedStatus = null;
        this.#selectedType = null;
        this.#searchCorrelationId = "";
    }

    connect() {
        if (this.#connection) {
            return;
        }

        this.#connectionStatus = "connecting";
        this.#error = null;

        this.#connection = source("/api/operations/timeline", {
            // sveltekit-sse uses POST; explicitly retain the browser origin so
            // SvelteKit's default CSRF protection accepts this same-origin stream.
            headers: {
                Origin: window.location.origin
            },
            onopen: () => {
                this.#connectionStatus = "connected";
            },
            onclose: ({ connect }) => {
                if (this.#connectionStatus !== "disconnected") {
                    this.#connectionStatus = "error";
                    setTimeout(() => {
                        if (this.#connectionStatus !== "disconnected") {
                            void connect();
                        }
                    }, 1500);
                }
            },
            onerror: ({ error, connect }) => {
                logger.error("Operations stream error:", error);
                this.#error = "Live timeline connection error";
                this.#connectionStatus = "error";
                setTimeout(() => {
                    if (this.#connectionStatus !== "disconnected") {
                        this.#connectionStatus = "connecting";
                        void connect();
                    }
                }, 1500);
            }
        });

        const opStream = this.#connection
            .select("operation")
            .json<OperationItem>(({ error, raw, previous }) => {
                // Ignore empty transport/keepalive payloads without surfacing a false warning.
                if (raw.trim()) {
                    logger.warn("Failed to parse operation timeline event:", error);
                }
                return previous;
            });

        this.#unsubscribe = opStream.subscribe((newItem) => {
            if (newItem) {
                this.upsertItem(newItem);
            }
        });
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
}

export const operationsStore = new OperationsStore();
