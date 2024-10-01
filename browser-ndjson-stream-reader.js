/* 
Utility function to read a ND-JSON HTTP stream.
`processLine` is a function taking a JSON object. It will be called with each element of the stream.
`response` is the result of a `fetch` request.
*/

let gameStream = null;

const readStream = (processLine) => response => {

    gameStream = response.body.getReader();
    const matcher = /\r?\n/;
    const decoder = new TextDecoder();
    let buf = '';

    const loop = () =>
        gameStream.read()
            .then(({ done, value }) => {
                if (done) {
                    if (buf.length > 0) processLine(JSON.parse(buf));
                }
                else {
                    const chunk = decoder.decode(value, { stream: true });
                    buf += chunk;

                    const parts = buf.split(matcher);
                    buf = parts.pop();
                    for (const i of parts.filter(p => p)){
                        processLine(JSON.parse(i));
                    }
                        
                    return loop();
                }
            });

    return loop();
}