
let username = window.Twitch.ext.configuration.broadcaster?.content;
let evalOrientation = "white";
let isSearching = false;

window.Twitch.ext.configuration.onChanged(() => {
    username = window.Twitch.ext.configuration.broadcaster?.content;
});

window.Twitch.ext.listen("broadcast", (target, contentType, message) => {
    if (username != message && gameStream) {
        gameStream.cancel(`Now following ${message}.`);
    }
    username = message;
});

const resizeContainer = document.getElementById("resize-container");
const container = document.getElementById("eval-bar");
const inner = document.getElementById("inner-bar");
const dragArea = document.getElementById("drag-area");
const stockfishWorker = new Worker('stockfish-16.1-asm.js');

function onMouseDrag({ movementX, movementY }) {

    const style = window.getComputedStyle(resizeContainer);
    resizeContainer.style.left = `${parseInt(style.left) + movementX}px`;
    resizeContainer.style.top = `${parseInt(style.top) + movementY}px`;
}
dragArea.addEventListener("mousedown", () => {
    document.addEventListener("mousemove", onMouseDrag);
});
document.addEventListener("mouseup", () => {
    document.removeEventListener("mousemove", onMouseDrag);
});

inner.addEventListener('eval-change', (event) => {

    inner.firstElementChild.textContent = '';
    if (event.detail.mate) {
        if (event.detail.mate > 0) {
            inner.style.height = '100%';
            inner.firstElementChild.textContent = `M${event.detail.mate}`;
        }
        return;
    }
    if (event.detail.eval >= 0) {
        inner.firstElementChild.textContent = event.detail.eval.toFixed(1);
    }
    const clampedScore = Math.max(-4, Math.min(event.detail.eval, 4));
    const newHeight = 5 + ((clampedScore + 4) / 8) * 90;
    inner.style.height = `${newHeight}%`;
});

container.addEventListener('eval-change', (event) => {

    container.firstElementChild.textContent = '';
    if (event.detail.mate && event.detail.mate < 0) {
        inner.style.height = '0%';
        return container.firstElementChild.textContent = `M${event.detail.mate * -1}`;
    }
    if (event.detail.eval && event.detail.eval < 0) {
        container.firstElementChild.textContent = event.detail.eval.toFixed(1).substring(1);
    }
});

stockfishWorker.onmessage = function (event) {

    if (event.data.startsWith('bestmove')) {
        isSearching = false;
    }
    else if (event.data.includes('seldepth') && event.data.substring(11, 13) > 19) {

        let eval = parseInt(event.data.match('cp (-?[0-9]+)')?.[1]) / 100;
        let mate = parseInt(event.data.match('mate (-?[0-9]+)')?.[1]);
        inner.dispatchEvent(new CustomEvent('eval-change', { bubbles: true, detail: { eval: eval, mate: mate } }));
    }
};

stockfishWorker.postMessage('uci');
stockfishWorker.postMessage(`setoption name Threads value ${navigator.hardwareConcurrency}`);
run();

async function run() {

    while (true) {
        await fetchGameStream();
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

async function fetchGameStream() {

    if (username == undefined) {
        return;
    }
    const url = `https://lichess.org/api/users/status?ids=${username}&withGameIds=true`;
    await fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(response.status);
            }
            return response.json();
        })
        .then(async data => {

            if (!data[0].playing) {
                console.log(`${username} is not playing`);
                return;
            }

            let startTurn = 0;
            await fetch(`https://lichess.org/api/stream/game/${data[0].playingId}`)
                .then(readStream(response => {

                    if (response.status) {
                        const playerColor = (response.players.white.user.name.toLowerCase() == username.toLowerCase()) ? "white" : "black";
                        if (playerColor != evalOrientation) {
                            evalOrientation = playerColor;
                            container.classList.toggle('eval-flip');
                        }
                        isSearching = true;
                        stockfishWorker.postMessage('ucinewgame');
                        stockfishWorker.postMessage(`position fen ${response.fen}`);
                        stockfishWorker.postMessage('go depth 20');
                        startTurn = response.turns;
                        return;
                    }
                    if (--startTurn < 0 && !isSearching) {
                            isSearching = true;
                            stockfishWorker.postMessage(`position fen ${response.fen}`);
                            stockfishWorker.postMessage('go depth 20');
                    }
                }))
                .catch(error => {
                    console.error('Network or request error 2: ', error);
                });
        })
        .catch(error => {
            console.error('Network or request error 1: ', error);
        });
};