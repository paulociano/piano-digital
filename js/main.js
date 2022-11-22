document.body.addEventListener('keyup', (e) => {
    playMusic(e.code.toLowerCase());
    console.log(e.code);
});

document.body.addEventListener('click', (e) => {
    playMusic((e.target).getAttribute('data-key'));
})

function letsPlay() {
    let track = document.querySelector('#input').value.toLowerCase();

    if(track !== '') {
        let trackArray = track.split('');
        playTrack(trackArray);
    }
    
}

function playMusic(music) {
    let audioElement = document.querySelector(`#s_${music}`);
    let keyElement = document.querySelector(`div[data-key="${music}"]`);

    if(audioElement) {
        audioElement.currentTime = 0;
        audioElement.play();
    }

    if(keyElement) {
        keyElement.classList.add('active');
        setTimeout(() => {
            keyElement.classList.remove('active');
        }, 300);
    }
}

function playTrack(trackArray) {
    let wait = 0;

    for(let item of trackArray) {
        setTimeout(()=>{
            playMusic(`key${item}`);
        }, wait);
        wait += 250;
    }
}