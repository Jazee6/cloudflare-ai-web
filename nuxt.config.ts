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
        }
    }
})
