import Dexie, {type Table} from 'dexie';
import type {HistoryItem} from "~/utils/req";

export class historyDB extends Dexie {
    history!: Table<HistoryItem>;

    constructor() {
        super('ai');
        this.version(1).stores({
            history: '++id, role, content, is_img'
        });
    }
}

export const historyDB1 = new historyDB();
