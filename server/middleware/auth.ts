export default defineEventHandler((event) => {
    const pass = process.env.PASSWORD
    if (pass) {
        if (event.path.startsWith('/api/auth')) {
            if (event.headers.get('Authorization') !== pass) {
                return new Response('', {status: 401, statusText: 'password incorrect'})
            }
        }
    }
})