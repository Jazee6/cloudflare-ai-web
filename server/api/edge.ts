export const config = {
    runtime: 'edge',
};

export default async function handler() {
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
        start(controller) {
            if (typeof EdgeRuntime === 'string') {
                controller.enqueue(encoder.encode("EdgeRuntime!!!"));
            }
            controller.close();
        },
    });

    return new Response(customReadable, {
        headers: {'Content-Type': 'text/html; charset=utf-8'},
    });
}