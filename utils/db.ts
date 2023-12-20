import Dexie, {type Table} from 'dexie';

export class Database extends Dexie {
    history!: Table;
    tab!: Table;

    constructor() {
        super('ai');
        this.version(1).stores({
            history: '++id, *session, role, content, is_img',
            tab: '++id, content'
        });
    }
}

export const DB = new Database();

export async function getLatestTab() {
    return DB.tab.orderBy('id').last();
}

export async function getHistory(session: number) {
    return DB.history.where('session').equals(session).limit(100).toArray()
}