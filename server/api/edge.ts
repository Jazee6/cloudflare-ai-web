export const config = {
    runtime: 'edge',
};

export default async function handler() {
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode('Basic Streaming Test'));
            controller.close();
        },
    });

    return new Response(customReadable, {
        headers: {'Content-Type': 'text/html; charset=utf-8'},
    });
}