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
    const shortcutToggle = document.getElementById('shortcut-toggle');
    const introPrompt = document.getElementById('intro-prompt');
    const recordButton = document.getElementById('record');
    const recordLabel = document.getElementById('record-label');
    const clearRecordingButton = document.getElementById('clear-recording');
    const recordingStatus = document.getElementById('recording-status');
    const sequenceTrack = document.getElementById('sequence-track');
    const sequenceCount = document.getElementById('sequence-count');
    const heldKeys = new Set();
    const pointers = new Map();
    const flashes = new Map();
    let timer = null;
    let playing = false;
    let recording = false;
    let recordingNotes = [];
    let hasPlayedFirstNote = false;
    let run = 0;

    function parseMelody(value = melody.value) {
        return Array.from(value.toLowerCase().replace(/\s/g, '').replace(/[–—]/g, '-'));
    }

    function noteLabel(letter) {
        if (letter === '-') return 'Pausa';
        const key = keys.get(letter);
        return key ? key.dataset.note : letter.toUpperCase();
    }

    function renderSequence(activeIndex = -1) {
        const notes = parseMelody();
        const validNotes = notes.filter(note => note === '-' || keys.has(note));
        sequenceCount.textContent = `${validNotes.length} ${validNotes.length === 1 ? 'passo' : 'passos'}`;
        sequenceTrack.textContent = '';

        if (!validNotes.length) {
            const empty = document.createElement('span');
            empty.className = 'sequence-empty';
            empty.textContent = 'Grave ou escreva algumas notas para começar.';
            sequenceTrack.append(empty);
            return;
        }

        validNotes.forEach((note, index) => {
            const step = document.createElement('span');
            step.className = `sequence-step${note === '-' ? ' is-pause' : ''}${index === activeIndex ? ' is-active' : ''}`;
            step.dataset.sequenceIndex = String(index);

            const label = document.createElement('span');
            label.className = 'sequence-note';
            label.textContent = noteLabel(note);

            const keyLabel = document.createElement('span');
            keyLabel.className = 'sequence-key';
            keyLabel.textContent = note === '-' ? '—' : note.toUpperCase();

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'sequence-remove';
            remove.dataset.removeIndex = String(index);
            remove.setAttribute('aria-label', `Remover ${noteLabel(note)} da sequência`);
            remove.textContent = '×';

            step.append(label, keyLabel, remove);
            sequenceTrack.append(step);
        });

        const active = sequenceTrack.querySelector('.is-active');
        if (active) active.scrollIntoView({block:'nearest', inline:'nearest'});
    }

    function syncMelodyFromNotes(notes) {
        melody.value = notes.map(note => note === '-' ? '—' : note.toUpperCase()).join(' ');
        renderSequence();
    }

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

        if (!hasPlayedFirstNote) {
            hasPlayedFirstNote = true;
            introPrompt.innerHTML = '<span aria-hidden="true">↳</span> Agora experimente duas teclas juntas. Você já está tocando.';
        }
        if (recording && !playing) {
            recordingNotes.push(letter.toUpperCase());
            melody.value = recordingNotes.join(' ');
            renderSequence();
            clearRecordingButton.disabled = false;
            recordingStatus.textContent = `${recordingNotes.length} ${recordingNotes.length === 1 ? 'nota gravada' : 'notas gravadas'}.`;
        }
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
        recordButton.disabled = false;
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
        if (event.key === 'Escape' && recording) {
            stopRecording();
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
    keyboard.addEventListener('pointermove', event => {
        const previous = pointers.get(event.pointerId);
        if (!previous) return;
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const key = hit && hit.closest ? hit.closest('[data-key]') : null;
        if (!key || key.dataset.key === previous) return;
        const letter = key.dataset.key;
        pointers.set(event.pointerId, letter);
        updateKey(previous);
        updateKey(letter);
        playNote(letter);
    });

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
        if (recording) stopRecording();
        const notes = parseMelody();
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
        recordButton.disabled = true;
        progress.max = notes.length;
        progress.value = 0;
        status.textContent = 'Tocando sua melodia. Use Parar ou Esc para interromper.';
        stopButton.focus();
        const thisRun = run;
        let index = 0;
        function next() {
            if (!playing || run !== thisRun) return;
            if (index >= notes.length) {
                renderSequence();
                stopPlayback('Melodia concluída. Que tal criar outra?');
                playButton.focus();
                return;
            }
            const noteIndex = index;
            const note = notes[index++];
            renderSequence(noteIndex);
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

    function stopRecording() {
        if (!recording) return;
        recording = false;
        recordButton.classList.remove('is-recording');
        recordButton.setAttribute('aria-pressed', 'false');
        recordLabel.textContent = 'Gravar';
        recordingStatus.textContent = recordingNotes.length
            ? `Gravação concluída com ${recordingNotes.length} ${recordingNotes.length === 1 ? 'nota' : 'notas'}.`
            : 'Nenhuma nota gravada.';
        status.textContent = recordingNotes.length
            ? 'Sua performance virou uma sequência editável.'
            : 'Toque alguma nota durante a gravação.';
    }

    recordButton.setAttribute('aria-pressed', 'false');
    recordButton.addEventListener('click', () => {
        if (playing) return;
        if (recording) {
            stopRecording();
            melody.focus();
            return;
        }
        recordingNotes = [];
        melody.value = '';
        renderSequence();
        progress.value = 0;
        error.hidden = true;
        melody.removeAttribute('aria-invalid');
        clearRecordingButton.disabled = true;
        recording = true;
        recordButton.classList.add('is-recording');
        recordButton.setAttribute('aria-pressed', 'true');
        recordLabel.textContent = 'Parar gravação';
        recordingStatus.textContent = 'Gravando. Toque no piano ou use o teclado.';
        status.textContent = 'Performance em gravação.';
    });

    clearRecordingButton.addEventListener('click', () => {
        if (recording) stopRecording();
        recordingNotes = [];
        melody.value = '';
        renderSequence();
        progress.value = 0;
        clearRecordingButton.disabled = true;
        recordingStatus.textContent = 'Pronto para gravar.';
        status.textContent = 'Seu próximo som começa aqui.';
        melody.focus();
    });

    shortcutToggle.addEventListener('click', () => {
        const hidden = document.body.classList.toggle('hide-shortcuts');
        shortcutToggle.setAttribute('aria-pressed', String(!hidden));
        shortcutToggle.firstChild.textContent = hidden ? 'Mostrar teclas ' : 'Teclas ';
    });

    sequenceTrack.addEventListener('click', event => {
        const remove = event.target.closest('[data-remove-index]');
        if (!remove || playing || recording) return;
        const notes = parseMelody().filter(note => note === '-' || keys.has(note));
        const index = Number(remove.dataset.removeIndex);
        if (!Number.isInteger(index) || index < 0 || index >= notes.length) return;
        notes.splice(index, 1);
        syncMelodyFromNotes(notes);
        clearRecordingButton.disabled = notes.length === 0;
        status.textContent = notes.length ? 'Nota removida da sequência.' : 'Sequência limpa.';
    });

    melody.addEventListener('input', () => {
        renderSequence();
        error.hidden = true;
        melody.removeAttribute('aria-invalid');
        progress.value = 0;
        status.textContent = 'Sua melodia está pronta para ganhar som.';
    });
    exampleButton.addEventListener('click', () => {
        if (recording) stopRecording();
        melody.value = 'D D F G G F D S A A S D D S S — D D F G G F D S A A S D S A A';
        renderSequence();
        clearRecordingButton.disabled = false;
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
    renderSequence();

    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (recording) stopRecording();
            stopPlayback('Piano pausado ao sair da página.');
        }
    });
})();
