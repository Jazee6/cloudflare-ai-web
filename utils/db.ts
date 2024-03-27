import Dexie, {type Table} from 'dexie';

export interface Model {
    id: string
    name: string
    provider: 'openai' | 'workers-ai'
    type: 'chat' | 'text-to-image' | 'image-to-text' | 'text-to-text'
    endpoint?: string
}

export interface HistoryItem {
    id?: number
    session: number
    type: 'text' | 'image' | 'image-prompt'
    content: string
    role: 'user' | 'assistant'
}

export interface TabItem {
    id?: number
    label: string
}

export class Database extends Dexie {
    history!: Table<HistoryItem>
    tab!: Table<TabItem>

    constructor() {
        super('ai')
        this.version(3).stores({
            history: '++id, session, type, role, content',
            tab: '++id, label'
        }).upgrade(tx => {
            return tx.table('history').toCollection().modify(item => {
                if (item['is_img']) {
                    item.type = 'image'
                } else {
                    item.type = 'text'
                }
            })
        })
    }

    getLatestTab() {
        return DB.tab.orderBy('id').last();
    }

    getTabs() {
        return DB.tab.limit(100).reverse().toArray()
    }

    getHistory(session: number) {
        return DB.history.where('session').equals(session).limit(100).toArray()
    }

    addTab(label: string) {
        return DB.tab.add({label})
    }

    deleteTabAndHistory(id: number) {
        return DB.transaction('rw', DB.tab, DB.history, async () => {
            await DB.tab.delete(id)
            await DB.history.where('session').equals(id).delete()
        })
    }
}

export const DB = new Database();

export const textGenModels: Model[] = [{
    id: 'gpt-3.5-turbo',
    name: 'ChatGPT-3.5-turbo',
    provider: 'openai',
    endpoint: 'chat/completions',
    type: 'chat'
},{
    id: '@cf/meta/llama-2-7b-chat-fp16',
    name: 'llama-2-7b-chat-fp16',
    provider: 'workers-ai',
    type: 'chat'
}, {
    id: '@cf/meta/llama-2-7b-chat-int8',
    name: 'llama-2-7b-chat-int8',
    provider: 'workers-ai',
    type: 'chat'
}, {
    id: '@cf/mistral/mistral-7b-instruct-v0.1',
    name: 'mistral-7b-instruct-v0.1',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@cf/thebloke/discolm-german-7b-v1-awq',
    name: 'discolm-german-7b-v1-awq',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@cf/tiiuae/falcon-7b-instruct',
    name: 'falcon-7b-instruct',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@hf/thebloke/llama-2-13b-chat-awq',
    name: 'llama-2-13b-chat-awq',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@hf/thebloke/llamaguard-7b-awq',
    name: 'llamaguard-7b-awq',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@hf/thebloke/mistral-7b-instruct-v0.1-awq',
    name: 'mistral-7b-instruct-v0.1-awq',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@hf/thebloke/neural-chat-7b-v3-1-awq',
    name: 'neural-chat-7b-v3-1-awq',
    provider: 'workers-ai',
    type: 'chat'
},{
    id: '@cf/openchat/openchat-3.5-0106',
    name: 'openchat-3.5-0106',
    provider: 'workers-ai',
    type: 'chat'
}]

export const imageGenModels: Model[] = [{
    id: '@cf/lykon/dreamshaper-8-lcm',
    name: 'dreamshaper-8-lcm',
    provider: 'workers-ai',
    type: 'text-to-image'
}, {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: 'stable-diffusion-xl-base-1.0',
    provider: 'workers-ai',
    type: 'text-to-image'
}]

export const models: Model[] = [...textGenModels, ...imageGenModels]