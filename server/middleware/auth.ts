const pass = process.env.PASSWORD

export default defineEventHandler((event) => {
    if (pass) {
        if (event.path.startsWith('/api/auth')) {
            if (event.headers.get('Authorization') !== pass) {
                return new Response('Unauthorized', {status: 401})
            }
        }
    }
})