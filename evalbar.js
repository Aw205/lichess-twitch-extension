
let username = window.Twitch.ext.configuration.broadcaster?.content;
let evalOrientation = "white";

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
        if(event.detail.mate > 0){
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
                        const playerColor = (response.players.white.user.name == username) ? "white" : "black";
                        if (playerColor != evalOrientation) {
                            evalOrientation = playerColor;
                            container.classList.toggle('eval-flip');
                        }
                        fetchStockfishEval(response.fen);
                        startTurn = response.turns;
                        return;
                    }
                    if (--startTurn < 0) {
                        fetchStockfishEval(response.fen);
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

function fetchStockfishEval(fen) {

    const queryString = new URLSearchParams({ fen: fen, depth: 10 }).toString();
    fetch(`https://stockfish.online/api/s/v2.php?${queryString}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            inner.dispatchEvent(new CustomEvent('eval-change', { bubbles: true, detail: { eval: data.evaluation, mate: data.mate } }));
        })
        .catch(error => {
            console.error('An error occured: ', error);
        });
}