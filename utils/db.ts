import Dexie, {type Table} from 'dexie';

export class Database extends Dexie {
    history!: Table;
    tab!: Table;

    constructor() {
        super('ai');
        this.version(2).stores({
            history: '++id, session, role, content, is_img',
            tab: '++id, content'
        })
    }
}

export const DB = new Database();

export function getLatestTab() {
    return DB.tab.orderBy('id').last();
}

export function getHistory(session: number) {
    return DB.history.where('session').equals(session).limit(100).toArray()
}

export function getTabs() {
    return DB.tab.limit(100).reverse().toArray()
}

export function addTab(content: string) {
    return DB.tab.add({content})
}
