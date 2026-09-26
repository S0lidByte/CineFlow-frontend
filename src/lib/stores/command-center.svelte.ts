import type { CommandCategory } from "$lib/components/navigation/command-center";

export class CreateCommandCenterStore {
    #isOpen = $state(false);
    #query = $state("");
    #activeCategory = $state<CommandCategory | "all">("all");

    get isOpen() {
        return this.#isOpen;
    }

    set isOpen(value: boolean) {
        this.#isOpen = value;
    }

    get query() {
        return this.#query;
    }

    set query(value: string) {
        this.#query = value;
    }

    get activeCategory() {
        return this.#activeCategory;
    }

    set activeCategory(value: CommandCategory | "all") {
        this.#activeCategory = value;
    }

    toggle() {
        this.#isOpen = !this.#isOpen;
    }

    open(initialQuery = "") {
        this.#query = initialQuery;
        this.#isOpen = true;
    }

    close() {
        this.#isOpen = false;
        this.#query = "";
    }
}

export const commandCenterStore = new CreateCommandCenterStore();
