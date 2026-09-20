(() => {
    'use strict';

    const keys = new Map(Array.from(document.querySelectorAll('[data-key]'), key => [key.dataset.key, key]));
    const sounds = new Map(Array.from(keys.keys(), letter => [letter, document.getElementById(`s_key${letter}`)]));
    const keyboard = document.querySelector('.keys');
    const melody = document.getElementById('melody');
    const form = document.getElementById('composer-form');
    const playButton = document.getElementById('play');
    const stopButton = document.getElementById('stop');
    const exampleButton = document.getElementById('example');
    const volume = document.getElementById('volume');
    const tempo = document.getElementById('tempo');
    const status = document.getElementById('playback-status');
    const error = document.getElementById('melody-error');
    const progress = document.getElementById('progress');
    const currentNote = document.getElementById('current-note');
    const heldKeys = new Set();
    const pointers = new Map();
    const flashes = new Map();
    let timer = null;
    let playing = false;
    let run = 0;

    function updateKey(letter) {
        keys.get(letter).classList.toggle('active', heldKeys.has(letter) || Array.from(pointers.values()).includes(letter) || flashes.has(letter));
    }

    function flashKey(letter, duration = 180) {
        clearTimeout(flashes.get(letter));
        flashes.set(letter, setTimeout(() => {
            flashes.delete(letter);
            updateKey(letter);
        }, duration));
        updateKey(letter);
    }

    function playNote(letter) {
        const audio = sounds.get(letter);
        if (!audio) return;
        const attempt = run;
        audio.volume = Number(volume.value) / 100;
        audio.currentTime = 0;
        currentNote.textContent = keys.get(letter).dataset.note;
        const result = audio.play();
        if (result) result.catch(reason => {
            // A stop or a retrigger may interrupt a pending play request.
            if (reason.name === 'AbortError' || attempt !== run) return;
            stopPlayback('Não foi possível tocar o áudio. Tente novamente.');
        });
    }

    function clearKeys() {
        heldKeys.clear();
        pointers.clear();
        flashes.forEach(clearTimeout);
        flashes.clear();
        keys.forEach(key => key.classList.remove('active'));
        currentNote.textContent = 'Pronto para tocar';
    }

    function stopPlayback(message = 'Reprodução interrompida.') {
        run++;
        clearTimeout(timer);
        timer = null;
        playing = false;
        playButton.disabled = false;
        stopButton.disabled = true;
        melody.readOnly = false;
        exampleButton.disabled = false;
        sounds.forEach(audio => {
            audio.pause();
            if (audio.readyState > 0) audio.currentTime = 0;
        });
        clearKeys();
        status.textContent = message;
    }

    function editableTarget(target) {
        return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && playing) {
            stopPlayback();
            return;
        }
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || editableTarget(event.target)) return;
        const letter = event.key.toLowerCase();
        if (!keys.has(letter)) return;
        event.preventDefault();
        heldKeys.add(letter);
        updateKey(letter);
        playNote(letter);
    });

    document.addEventListener('keyup', event => {
        const letter = event.key.toLowerCase();
        if (!keys.has(letter)) return;
        heldKeys.delete(letter);
        updateKey(letter);
    });

    keyboard.addEventListener('pointerdown', event => {
        const key = event.target.closest('[data-key]');
        if (!key || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const letter = key.dataset.key;
        key.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, letter);
        updateKey(letter);
        playNote(letter);
    });

    function releasePointer(event) {
        const letter = pointers.get(event.pointerId);
        if (!letter) return;
        pointers.delete(event.pointerId);
        updateKey(letter);
    }
    keyboard.addEventListener('pointerup', releasePointer);
    keyboard.addEventListener('pointercancel', releasePointer);
    keyboard.addEventListener('lostpointercapture', releasePointer);
    // Native button activation covers Enter, Space and assistive technology.
    keyboard.addEventListener('click', event => {
        if (event.detail !== 0) return;
        const key = event.target.closest('[data-key]');
        if (!key) return;
        playNote(key.dataset.key);
        flashKey(key.dataset.key);
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (playing) return;
        const notes = Array.from(melody.value.toLowerCase().replace(/\s/g, '').replace(/[–—]/g, '-'));
        if (!notes.some(note => keys.has(note)) || notes.some(note => note !== '-' && !keys.has(note))) {
            error.textContent = 'Escreva pelo menos uma nota. Use apenas A W S E D F T G Y H U J K, espaços e traços para as pausas.';
            error.hidden = false;
            melody.setAttribute('aria-invalid', 'true');
            melody.focus();
            return;
        }
        error.hidden = true;
        melody.removeAttribute('aria-invalid');
        stopPlayback();
        playing = true;
        playButton.disabled = true;
        stopButton.disabled = false;
        melody.readOnly = true;
        exampleButton.disabled = true;
        progress.max = notes.length;
        progress.value = 0;
        status.textContent = 'Tocando sua melodia. Use Parar ou Esc para interromper.';
        stopButton.focus();
        const thisRun = run;
        let index = 0;
        function next() {
            if (!playing || run !== thisRun) return;
            if (index >= notes.length) {
                stopPlayback('Melodia concluída. Que tal criar outra?');
                playButton.focus();
                return;
            }
            const note = notes[index++];
            const interval = 60000 / Number(tempo.value);
            if (note !== '-') {
                playNote(note);
                flashKey(note, Math.min(interval * .75, 350));
            } else {
                currentNote.textContent = 'Pausa';
                sounds.forEach(audio => audio.pause());
            }
            progress.value = index;
            timer = setTimeout(next, interval);
        }
        next();
    });

    melody.addEventListener('input', () => {
        error.hidden = true;
        melody.removeAttribute('aria-invalid');
        progress.value = 0;
        status.textContent = 'Sua melodia está pronta para ganhar som.';
    });
    exampleButton.addEventListener('click', () => {
        melody.value = 'D D F G G F D S A A S D D S S — D D F G G F D S A A S D S A A';
        error.hidden = true;
        melody.removeAttribute('aria-invalid');
        progress.value = 0;
        status.textContent = 'Exemplo carregado: Ode à Alegria. Toque a melodia ou experimente mudar as notas.';
        melody.focus();
    });
    stopButton.addEventListener('click', () => {
        stopPlayback();
        playButton.focus();
    });
    volume.addEventListener('input', () => {
        document.getElementById('volume-value').textContent = `${volume.value}%`;
        sounds.forEach(audio => { audio.volume = Number(volume.value) / 100; });
    });
    tempo.addEventListener('input', () => {
        document.getElementById('tempo-value').textContent = `${tempo.value} BPM`;
    });
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopPlayback('Piano pausado ao sair da página.');
    });
})();
