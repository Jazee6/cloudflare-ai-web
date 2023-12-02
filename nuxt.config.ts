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
    devServer: {
        host: '0.0.0.0'
    }
})
