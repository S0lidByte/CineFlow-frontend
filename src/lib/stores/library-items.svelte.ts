export class ItemStore {
    #selectedItems = $state<number[]>([]);
    #scopeKey = $state<string | null>(null);

    get items() {
        return this.#selectedItems;
    }

    get count() {
        return this.#selectedItems.length;
    }

    clear() {
        this.#selectedItems = [];
    }

    syncScope(scopeKey: string) {
        if (this.#scopeKey === null) {
            this.#scopeKey = scopeKey;
            return;
        }

        if (this.#scopeKey !== scopeKey) {
            this.clear();
            this.#scopeKey = scopeKey;
        }
    }

    resetScope() {
        this.clear();
        this.#scopeKey = null;
    }

    has(id: number): boolean {
        return this.#selectedItems.indexOf(id) > -1;
    }

    toggle(id: number) {
        const index = this.#selectedItems.indexOf(id);
        if (index > -1) {
            this.#selectedItems.splice(index, 1);
        } else {
            this.#selectedItems.push(id);
        }
    }
}
