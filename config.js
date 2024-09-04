
const saveButton = document.getElementById('save-button');
const usernameInput = document.getElementById('username');
const errorMessage = document.getElementById('error-message');

window.Twitch.ext.configuration.onChanged(() => {
    usernameInput.value = window.Twitch.ext.configuration.broadcaster.content;
});

saveButton.addEventListener('click', () => {
    let username = usernameInput.value;

    fetch(`https://lichess.org/api/users/status?ids=${username}`)
        .then(response => {
            if (!response.ok) {
                usernameInput.classList.add("username-error");
                errorMessage.style.visibility = "visible";
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.length == 0) {
                usernameInput.classList.add("username-error");
                errorMessage.style.visibility = "visible";
                throw new Error("Username doesn't exist");
            }
        })
        .then(onSuccess => {

            window.Twitch.ext.configuration.set("broadcaster", "0.01", username);
            window.Twitch.ext.send("broadcast", "application/json", username);

            usernameInput.classList.remove("username-error");
            errorMessage.style.visibility = "hidden";
            saveButton.textContent = 'Saved!';
            saveButton.disabled = true;
            setTimeout(() => {
                saveButton.textContent = 'Save';
                saveButton.disabled = false;
            }, 2000);
        })
        .catch(error => {
            console.error('Network or request error: ', error);
        });
});