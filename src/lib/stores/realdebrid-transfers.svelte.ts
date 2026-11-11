import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";
import type { components } from "$lib/providers/riven";

const logger = createScopedLogger("rd-transfers-store");

function extractErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null) {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj.detail === "string") return errObj.detail;
        if (typeof errObj.message === "string") return errObj.message;
        return JSON.stringify(error);
    }
    return fallback;
}

export type RealDebridTransferItem = components["schemas"]["RealDebridTransferItem"];
export type RealDebridTransferStats = components["schemas"]["RealDebridTransferStats"];
export type RealDebridTransferDetail = components["schemas"]["RealDebridTransferDetail"];
export type RealDebridTransferFile = components["schemas"]["RealDebridTransferFile"];

export class RealDebridTransfersStore {
    #transfers = $state<RealDebridTransferItem[]>([]);
    #stats = $state<RealDebridTransferStats>({
        total: 0,
        active: 0,
        queued: 0,
        downloaded: 0,
        failed: 0,
        active_slots_used: 0,
        active_slots_limit: 20
    });
    #rdEnabled = $state<boolean>(true);
    #isLoading = $state<boolean>(false);
    #error = $state<string | null>(null);
    #selectedStatus = $state<string | null>(null);
    #searchQuery = $state<string>("");
    #cancellingId = $state<string | null>(null);
    #retryingId = $state<string | null>(null);
    #detailsMap = $state<Record<string, RealDebridTransferDetail>>({});
    #loadingDetailId = $state<string | null>(null);

    get transfers() {
        return this.#transfers;
    }

    get stats() {
        return this.#stats;
    }

    get rdEnabled() {
        return this.#rdEnabled;
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
            void this.fetchTransfers();
        }
    }

    get searchQuery() {
        return this.#searchQuery;
    }

    set searchQuery(val: string) {
        this.#searchQuery = val;
    }

    get cancellingId() {
        return this.#cancellingId;
    }

    get retryingId() {
        return this.#retryingId;
    }

    get detailsMap() {
        return this.#detailsMap;
    }

    get loadingDetailId() {
        return this.#loadingDetailId;
    }

    setTransfers(items: RealDebridTransferItem[]) {
        this.#transfers = items;
    }

    setStats(stats: RealDebridTransferStats) {
        this.#stats = stats;
    }

    reset() {
        this.#transfers = [];
        this.#stats = {
            total: 0,
            active: 0,
            queued: 0,
            downloaded: 0,
            failed: 0,
            active_slots_used: 0,
            active_slots_limit: 20
        };
        this.#error = null;
        this.#isLoading = false;
        this.#selectedStatus = null;
        this.#searchQuery = "";
        this.#cancellingId = null;
        this.#retryingId = null;
        this.#detailsMap = {};
        this.#loadingDetailId = null;
    }

    async fetchTransfers(forceRefresh: boolean = false) {
        try {
            this.#isLoading = true;
            this.#error = null;
            if (forceRefresh) {
                this.#detailsMap = {};
            }

            const query: Record<string, string | boolean> = {};
            if (this.#selectedStatus) {
                query.status = this.#selectedStatus;
            }
            if (this.#searchQuery.trim()) {
                query.search = this.#searchQuery.trim();
            }
            if (forceRefresh) {
                query.force_refresh = true;
            }

            const response = await providers.riven.GET("/api/v1/operations/realdebrid/transfers", {
                params: {
                    query: query as never
                }
            });

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to fetch transfers");
                throw new Error(err);
            }

            if (response.data) {
                this.#transfers = response.data.transfers || [];
                if (response.data.stats) {
                    this.#stats = response.data.stats;
                }
                this.#rdEnabled = response.data.rd_enabled ?? true;
                if (response.data.error) {
                    this.#error = response.data.error;
                }
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            logger.error("Failed to fetch Real-Debrid transfers:", e);
            this.#error = `Failed to fetch transfers: ${message}`;
        } finally {
            this.#isLoading = false;
        }
    }

    async fetchDetail(transferId: string): Promise<RealDebridTransferDetail | null> {
        if (this.#detailsMap[transferId]) {
            return this.#detailsMap[transferId];
        }

        try {
            this.#loadingDetailId = transferId;
            const response = await providers.riven.GET(
                "/api/v1/operations/realdebrid/transfers/{transfer_id}",
                {
                    params: {
                        path: {
                            transfer_id: transferId
                        }
                    }
                }
            );

            if (response.error) {
                throw new Error("Failed to load transfer detail");
            }

            if (response.data) {
                this.#detailsMap[transferId] = response.data;
                return response.data;
            }
            return null;
        } catch (e) {
            logger.error(`Failed to fetch detail for transfer ${transferId}:`, e);
            return null;
        } finally {
            if (this.#loadingDetailId === transferId) {
                this.#loadingDetailId = null;
            }
        }
    }

    async cancelTransfer(transferId: string): Promise<boolean> {
        try {
            this.#cancellingId = transferId;
            const response = await providers.riven.POST(
                "/api/v1/operations/realdebrid/transfers/{transfer_id}/cancel",
                {
                    params: {
                        path: {
                            transfer_id: transferId
                        }
                    }
                }
            );

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to cancel transfer");
                throw new Error(err);
            }

            // Immediately refresh list
            await this.fetchTransfers(true);
            return true;
        } catch (e) {
            logger.error(`Failed to cancel transfer ${transferId}:`, e);
            throw e;
        } finally {
            this.#cancellingId = null;
        }
    }

    async retryTransfer(transferId: string): Promise<boolean> {
        try {
            this.#retryingId = transferId;
            const response = await providers.riven.POST(
                "/api/v1/operations/realdebrid/transfers/{transfer_id}/retry",
                {
                    params: {
                        path: {
                            transfer_id: transferId
                        }
                    }
                }
            );

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to retry transfer");
                throw new Error(err);
            }

            // Immediately refresh list
            await this.fetchTransfers(true);
            return true;
        } catch (e) {
            logger.error(`Failed to retry transfer ${transferId}:`, e);
            throw e;
        } finally {
            this.#retryingId = null;
        }
    }

    async submitTransfer(magnet: string, mediaItemId?: number): Promise<string> {
        try {
            this.#isLoading = true;
            const response = await providers.riven.POST(
                "/api/v1/operations/realdebrid/transfers/submit",
                {
                    body: {
                        magnet,
                        media_item_id: mediaItemId ?? null
                    }
                }
            );

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to submit transfer");
                throw new Error(err);
            }

            await this.fetchTransfers(true);
            return response.data?.transfer_id || "";
        } catch (e) {
            logger.error("Failed to submit transfer to Real-Debrid:", e);
            throw e;
        } finally {
            this.#isLoading = false;
        }
    }

    async attachTransfer(transferId: string, mediaItemId: number): Promise<boolean> {
        try {
            this.#isLoading = true;
            const response = await providers.riven.POST(
                "/api/v1/operations/realdebrid/transfers/{transfer_id}/attach",
                {
                    params: {
                        path: {
                            transfer_id: transferId
                        }
                    },
                    body: {
                        media_item_id: mediaItemId
                    }
                }
            );

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to attach transfer");
                throw new Error(err);
            }

            await this.fetchTransfers(true);
            return true;
        } catch (e) {
            logger.error(`Failed to attach transfer ${transferId} to media #${mediaItemId}:`, e);
            throw e;
        } finally {
            this.#isLoading = false;
        }
    }

    async pollTransfers(): Promise<{ polled: number; ingested: number }> {
        try {
            const response = await providers.riven.POST(
                "/api/v1/operations/realdebrid/transfers/poll"
            );

            if (response.error) {
                const err = extractErrorMessage(response.error, "Failed to poll transfers");
                throw new Error(err);
            }

            await this.fetchTransfers(true);
            return {
                polled: response.data?.polled ?? 0,
                ingested: response.data?.ingested ?? 0
            };
        } catch (e) {
            logger.error("Failed to poll Real-Debrid transfers:", e);
            throw e;
        }
    }
}

export const realDebridTransfersStore = new RealDebridTransfersStore();
