export default defineEventHandler(() => {
    return new Response(process.env.PASSWORD ? 'true' : 'false')
})