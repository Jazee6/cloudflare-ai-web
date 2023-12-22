// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: {enabled: true},
    modules: ['@nuxt/ui'],
    css: ['~/assets/css/style.css'],
    routeRules: {
        '/': {
            prerender: true,
        }
    },
    app: {
        head: {
            title: 'Uni AI Web',
            meta: [
                {
                    name: 'keywords',
                    content: 'Uni AI Web, AI, Cloudflare Workers, ChatGPT, GeminiPro, Google Generative AI'
                },
                {
                    name: 'description',
                    content: 'Integrated web platform supporting GeminiPro/Cloudflare Workers AI/ChatGPT by Jazee6'
                }
            ]
        }
    }
})
