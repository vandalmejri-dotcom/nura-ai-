// Nura AI - Master Anything (Frontend Logic)
const API_BASE = 'http://localhost:8080/api';

// --- STATE MANAGEMENT ---
const State = {
    studySets: JSON.parse(localStorage.getItem('nuraSets_v6')) || [],
    currentSetId: null,

    // Set active set
    setActiveSet(id) {
        this.currentSetId = id;
    },

    // Get active set
    getActiveSet() {
        return this.studySets.find(s => s.id === this.currentSetId);
    },

    // Add new set
    addSet(setObject) {
        this.studySets.unshift(setObject);
        this.save();
    },

    // Delete set
    deleteSet(id) {
        this.studySets = this.studySets.filter(s => s.id !== id);
        if (this.currentSetId === id) this.currentSetId = null;
        this.save();
    },

    // Update active set
    updateActiveSet(updatedSet) {
        const index = this.studySets.findIndex(s => s.id === this.currentSetId);
        if (index > -1) {
            this.studySets[index] = updatedSet;
            this.save();
        }
    },

    // Save to local storage
    save() {
        localStorage.setItem('nuraSets_v6', JSON.stringify(this.studySets));
        UI.renderDashboard();
        UI.renderProgress();
    },

    clearAll() {
        this.studySets = [];
        this.currentSetId = null;
        this.save();
    }
};

// --- API SERVICE ---
const Api = {
    async uploadFile(file, progressCallback) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Fake progress steps for UI ux
            const steps = ["Reading file contents...", "Extracting key concepts...", "Drafting flashcards...", "Generating deep quizzes..."];
            let stepText = document.getElementById('analyzing-step');
            let i = 0;
            const stepInterval = setInterval(() => {
                if (i < steps.length) stepText.textContent = steps[i++];
            }, 2000);

            const req = new XMLHttpRequest();

            return new Promise((resolve, reject) => {
                req.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable && progressCallback) {
                        progressCallback((e.loaded / e.total) * 100);
                    }
                });

                req.addEventListener("load", () => {
                    clearInterval(stepInterval);
                    if (req.status >= 200 && req.status < 300) {
                        try {
                            const data = JSON.parse(req.responseText);
                            if (data.success) resolve(data.data);
                            else reject(new Error(data.error || 'Server returned failure structure'));
                        } catch (e) {
                            reject(new Error("Invalid JSON response from backend"));
                        }
                    } else {
                        try {
                            const err = JSON.parse(req.responseText);
                            reject(new Error(err.error || `HTTP ${req.status}`));
                        } catch (e) {
                            reject(new Error(`HTTP Error ${req.status}`));
                        }
                    }
                });

                req.addEventListener("error", () => {
                    clearInterval(stepInterval);
                    reject(new Error("Network Error occurred"));
                });

                req.open("POST", `${API_BASE}/upload`);
                req.send(formData);
            });

        } catch (error) {
            throw error;
        }
    },

    async processLink(link, text, options, language) {
        const res = await fetch(`${API_BASE}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link, text, options, language })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process link/text');
        return data.data;
    },

    async chatTutor(context, message) {
        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, message })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Chat failed');
        return data.reply;
    },

    async checkStatus() {
        try {
            const res = await fetch(`${API_BASE}/status`);
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    async setConfigKey(key) {
        const res = await fetch(`${API_BASE}/set-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
        return data;
    }
};

// --- UI / DOM CONTROLLER ---
const UI = {
    currentModalType: 'file',
    init() {
        // Sidebar Nav binding
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                if (targetView) this.switchView(targetView);
            });
        });

        // Modal Setup
        this.setupDragAndDrop();

        // Stage 1 -> Stage 2 logic
        document.getElementById('modal-next-btn').addEventListener('click', () => {
            if (this.currentModalType === 'link') {
                const linkVal = document.getElementById('url-input-field').value.trim();
                const textVal = document.getElementById('raw-text-field').value.trim();
                if (!linkVal && !textVal) return this.showToast('Please enter a URL or paste text', 'warning');
            } else if (this.currentModalType === 'file') {
                const fp = document.getElementById('file-input');
                if (!fp.files || fp.files.length === 0) {
                    return this.showToast('Please select a file first.', 'warning');
                }
            } else {
                return this.showToast('Recording not implemented yet', 'warning');
            }

            // Move to Stage 2
            document.getElementById('upload-stage-1').style.display = 'none';
            document.getElementById('modal-next-btn').style.display = 'none';
            document.getElementById('upload-modal-title').textContent = "What would you like to include?";
            document.querySelector('#upload-modal .modal-header p').textContent = "Choose all the methods you want included in your study set:";

            document.getElementById('upload-stage-2').style.display = 'block';
            document.getElementById('footer-stage-2').style.display = 'flex';
            document.getElementById('modal-generate-btn').style.display = 'block';
        });

        // Toggle generation options
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget;
                btnEl.classList.toggle('active');
            });
        });

        // Stage 2 -> Generate
        document.getElementById('modal-generate-btn').addEventListener('click', () => {
            const activeOpts = Array.from(document.querySelectorAll('.option-btn.active')).map(b => b.dataset.option);
            const language = document.getElementById('generation-language').value;

            if (this.currentModalType === 'link') {
                const linkVal = document.getElementById('url-input-field').value.trim();
                const textVal = document.getElementById('raw-text-field').value.trim();
                this.handleLinkSelected(linkVal, textVal, activeOpts, language);
            } else if (this.currentModalType === 'file') {
                const fp = document.getElementById('file-input');
                this.handleFileSelected(fp.files[0], activeOpts, language);
            }
        });

        // Initial Renders
        this.renderDashboard();
        this.renderProgress();

        // Switch to dashboard by default
        this.switchView('dashboard');
    },

    switchView(viewId) {
        if (viewId === 'study-sets') {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const navMatch = document.querySelector(`.nav-item[data-view="study-sets"]`);
            if (navMatch) navMatch.classList.add('active');

            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            document.getElementById('view-dashboard').classList.add('active');

            // Scroll to study sets section
            setTimeout(() => {
                document.querySelector('.study-sets-section').scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return;
        }

        // Update nav
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navMatch = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (navMatch) navMatch.classList.add('active');

        // Update view display
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const viewEl = document.getElementById(`view-${viewId}`);
        if (viewEl) viewEl.classList.add('active');
        else if (viewId === 'set-details') {
            document.getElementById('view-set-details').classList.add('active');
        }

        // Specific view hooks
        if (viewId === 'tutor') Tutor.renderContextDropdown();
        if (viewId === 'settings') Settings.loadSettingsPage();
    },

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'warning-circle';

        toast.innerHTML = `<i class="ph-fill ph-${icon}"></i> <span>${msg}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 4000);
    },

    // --- Dashboard Specific ---
    renderDashboard() {
        const sets = State.studySets;
        const grid = document.getElementById('study-sets-grid');
        const emptyState = document.getElementById('empty-state');

        if (sets.length === 0) {
            emptyState.style.display = 'flex';
            grid.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        grid.style.display = 'grid';

        grid.innerHTML = sets.map(set => {
            // Calculate stats
            let stats = { unfamiliar: 0, learning: 0, familiar: 0, mastered: 0 };
            const cardCount = set.flashcards ? set.flashcards.length : 0;

            if (set.flashcards) {
                set.flashcards.forEach(c => {
                    const st = c.status || 'unfamiliar';
                    if (stats[st] !== undefined) stats[st]++;
                });
            }

            const masteryPercentage = cardCount > 0 ? Math.round(((stats.mastered * 1) + (stats.familiar * 0.75) + (stats.learning * 0.3)) / cardCount * 100) : 0;

            return `
            <div class="study-card" onclick="StudyMode.openSet('${set.id}')">
                <div class="study-card-header">
                    <div>
                        <div class="study-card-title">${set.title}</div>
                        <div class="study-card-source">${set.sourceName || 'Unknown Source'}</div>
                    </div>
                    <button class="icon-btn" onclick="event.stopPropagation(); UI.confirmDelete('${set.id}')"><i class="ph ph-trash"></i></button>
                </div>
                
                <div class="study-stats-list mt-4">
                    <div class="stat-row">
                        <div class="stat-badge stat-unfamiliar">${stats.unfamiliar}</div>
                        <div class="stat-label stat-unfamiliar">Unfamiliar</div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-badge stat-learning">${stats.learning}</div>
                        <div class="stat-label stat-learning">Learning</div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-badge stat-familiar">${stats.familiar}</div>
                        <div class="stat-label stat-familiar">Familiar</div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-badge stat-mastered">${stats.mastered}</div>
                        <div class="stat-label stat-mastered">Mastered</div>
                    </div>
                </div>
                
                <div class="path-to-mastery mt-4">
                    <div style="display:flex; justify-content:space-between">
                        <span>Your path to mastery</span>
                        <span style="color:var(--text-primary); font-weight:600">${masteryPercentage}%</span>
                    </div>
                    <div class="mastery-progress-bar">
                        <div class="mastery-fill" style="width: ${masteryPercentage}%"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    renderProgress() {
        let totalCards = 0;
        let masteredCards = 0;

        State.studySets.forEach(set => {
            if (set.flashcards) {
                totalCards += set.flashcards.length;
                masteredCards += set.flashcards.filter(c => c.status === 'mastered').length;
            }
        });

        document.getElementById('prog-total-sets').textContent = State.studySets.length;
        document.getElementById('prog-total-cards').textContent = totalCards;
        document.getElementById('prog-mastered-cards').textContent = masteredCards;
    },

    // --- Modals ---
    openUploadModal(type) {
        this.currentModalType = type;
        document.getElementById('upload-modal').style.display = 'flex';
        // Reset view
        document.getElementById('dropzone').style.display = 'block';
        document.getElementById('url-input-zone').style.display = 'none';
        document.getElementById('record-zone').style.display = 'none';

        const title = document.getElementById('upload-modal-title');

        if (type === 'file') {
            title.textContent = "Please upload your file";
        } else if (type === 'link') {
            title.textContent = "Add Content";
            document.getElementById('dropzone').style.display = 'none';
            document.getElementById('url-input-zone').style.display = 'block';
        } else if (type === 'record') {
            title.textContent = "Record Audio";
            document.getElementById('dropzone').style.display = 'none';
            document.getElementById('record-zone').style.display = 'block';
        }
    },

    closeModal() {
        document.getElementById('upload-modal').style.display = 'none';
        // Reset stages
        document.getElementById('upload-stage-1').style.display = 'block';
        document.getElementById('upload-stage-2').style.display = 'none';
        document.getElementById('modal-next-btn').style.display = 'block';
        document.getElementById('modal-generate-btn').style.display = 'none';
        document.getElementById('footer-stage-2').style.display = 'none';
        document.querySelector('#upload-modal .modal-header p').textContent = "We will turn your file into insane study material";
    },

    setupDragAndDrop() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            // Do nothing, force user to click next
        });
    },

    async handleLinkSelected(link, text, options, language) {
        this.closeModal();
        const overlay = document.getElementById('analyzing-overlay');
        const progressBar = document.getElementById('loading-bar');

        overlay.style.display = 'flex';
        progressBar.style.width = '20%';

        try {
            const studySetData = await Api.processLink(link, text, options, language);

            progressBar.style.width = '100%';
            setTimeout(() => {
                overlay.style.display = 'none';
                studySetData.sourceContent = text || `Processed URL: ${link}`;

                if (studySetData.flashcards) {
                    studySetData.flashcards = studySetData.flashcards.map(c => ({ ...c, status: 'unfamiliar' }));
                }
                State.addSet(studySetData);
                this.showToast('Study set successfully generated!', 'success');
                StudyMode.openSet(studySetData.id);
            }, 600);

        } catch (error) {
            overlay.style.display = 'none';
            this.showToast(error.message, 'error');
            console.error(error);
        }

        document.getElementById('url-input-field').value = '';
        document.getElementById('raw-text-field').value = '';
    },

    async handleFileSelected(file, options, language) {
        this.closeModal();
        const overlay = document.getElementById('analyzing-overlay');
        const progressBar = document.getElementById('loading-bar');

        overlay.style.display = 'flex';
        progressBar.style.width = '0%';

        try {
            // Fake progression until network kicks in reliably
            progressBar.style.width = '30%';

            // We must append options and language to FormData inside Api.uploadFile
            const formData = new FormData();
            formData.append('file', file);
            formData.append('options', JSON.stringify(options));
            formData.append('language', language);

            const steps = ["Reading file contents...", "Extracting key concepts...", "Creating your tailored materials..."];
            let stepText = document.getElementById('analyzing-step');
            let i = 0;
            const stepInterval = setInterval(() => {
                if (i < steps.length) stepText.textContent = steps[i++];
            }, 2000);

            const req = new XMLHttpRequest();

            const studySetData = await new Promise((resolve, reject) => {
                req.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        progressBar.style.width = Math.min((e.loaded / e.total) * 100, 90) + '%';
                    }
                });

                req.addEventListener("load", () => {
                    clearInterval(stepInterval);
                    if (req.status >= 200 && req.status < 300) {
                        try {
                            const data = JSON.parse(req.responseText);
                            if (data.success) resolve(data.data);
                            else reject(new Error(data.error || 'Server returned failure structure'));
                        } catch (e) {
                            reject(new Error("Invalid JSON response from backend"));
                        }
                    } else {
                        try {
                            const err = JSON.parse(req.responseText);
                            reject(new Error(err.error || `HTTP ${req.status}`));
                        } catch (e) {
                            reject(new Error(`HTTP Error ${req.status}`));
                        }
                    }
                });

                req.addEventListener("error", () => {
                    clearInterval(stepInterval);
                    reject(new Error("Network Error occurred"));
                });

                req.open("POST", `${API_BASE}/upload`);
                req.send(formData);
            });

            progressBar.style.width = '100%';
            setTimeout(() => {
                overlay.style.display = 'none';

                // The backend now sends the properly parsed sourceContent (from pdf-parse or mammoth).
                // Use it directly instead of re-reading binary file as raw text.
                if (studySetData.sourceContent) {
                    processSetFrontEnd(studySetData);
                } else {
                    // Fallback for simple text/md files if backend didn't send it for some reason
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        studySetData.sourceContent = e.target.result;
                        processSetFrontEnd(studySetData);
                    };
                    reader.readAsText(file);
                }

                function processSetFrontEnd(set) {
                    // Force all flashcards to unfamiliar initially
                    if (set.flashcards) {
                        set.flashcards = set.flashcards.map(c => ({ ...c, status: 'unfamiliar' }));
                    }

                    State.addSet(set);
                    UI.showToast('Study set successfully generated!', 'success');
                    StudyMode.openSet(set.id);
                }

            }, 600);

        } catch (error) {
            overlay.style.display = 'none';
            this.showToast(error.message, 'error');
            console.error(error);
        }

        // reset input
        document.getElementById('file-input').value = '';
    },

    // --- Confirm Deletion ---
    confirmDelete(setId) {
        const modal = document.getElementById('confirm-modal');
        modal.style.display = 'flex';
        document.getElementById('confirm-yes-btn').onclick = () => {
            State.deleteSet(setId);
            this.showToast('Study set deleted', 'info');
            modal.style.display = 'none';
        };
    },

    closeConfirm() {
        document.getElementById('confirm-modal').style.display = 'none';
    }
};

// --- STUDY MODE CONTROLLER ---
const StudyMode = {
    currentCardIndex: 0,
    isFlipped: false,

    openSet(id) {
        State.setActiveSet(id);
        const set = State.getActiveSet();
        if (!set) return;

        // Setup details view header
        document.getElementById('set-details-title').textContent = set.title;
        document.getElementById('set-details-source').textContent = set.sourceName || 'Document';
        document.getElementById('set-details-date').textContent = new Date().toLocaleDateString();

        document.getElementById('delete-set-btn').onclick = () => {
            UI.confirmDelete(id);
            UI.switchView('dashboard');
        };

        // Setup tabs listeners
        const tabs = document.querySelectorAll('.set-tabs .tab-btn');
        tabs.forEach(btn => {
            // Remove old clones to avoid massive duplication
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;

                document.querySelectorAll('.set-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                newBtn.classList.add('active');

                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                document.getElementById(`tab-${targetTab}`).classList.add('active');
            });
        });

        // Default to content tab initially
        document.querySelectorAll('.set-tabs .tab-btn')[0].click();

        // Populate Content Tab
        document.getElementById('reader-content').textContent = set.sourceContent || "Content not available in local storage. (Was stored server-side).";

        // Render New Optional Content Tabs
        if (set.notes) document.getElementById('notes-content').innerHTML = `<div>${marked.parse(set.notes)}</div>`;
        else document.getElementById('notes-content').innerHTML = "<i>No Cornell Notes generated for this set.</i>";

        if (set.tutorLesson) document.getElementById('tutorlesson-content').innerHTML = `<div>${marked.parse(set.tutorLesson)}</div>`;
        else document.getElementById('tutorlesson-content').innerHTML = "<i>No Tutor Lesson generated for this set.</i>";

        if (set.writtenTests) document.getElementById('writtentests-content').innerHTML = `<div>${marked.parse(set.writtenTests)}</div>`;
        else document.getElementById('writtentests-content').innerHTML = "<i>No Written Tests generated for this set.</i>";

        if (set.fillInTheBlanks) document.getElementById('fillintheblanks-content').innerHTML = `<div>${marked.parse(set.fillInTheBlanks)}</div>`;
        else document.getElementById('fillintheblanks-content').innerHTML = "<i>No Fill in the Blanks generated for this set.</i>";

        if (set.podcast) document.getElementById('podcast-content').innerHTML = `<div>${marked.parse(set.podcast)}</div>`;
        else document.getElementById('podcast-content').innerHTML = "<i>No Podcast generated for this set.</i>";

        // Init Flashcards
        this.currentCardIndex = 0;
        this.isFlipped = false;
        this.renderFlashcard();

        // Init Quiz
        QuizMode.initQuiz(set);

        UI.switchView('set-details');
    },

    renderFlashcard() {
        const set = State.getActiveSet();
        if (!set || !set.flashcards || set.flashcards.length === 0) {
            document.getElementById('fc-front').textContent = "No flashcards available.";
            document.getElementById('fc-progress-text').textContent = "0 / 0";
            return;
        }

        const card = set.flashcards[this.currentCardIndex];
        const uiEl = document.getElementById('flashcard');

        // Prepare swap text after flip finishes if active
        if (this.isFlipped) {
            uiEl.classList.remove('is-flipped');
            this.isFlipped = false;
            setTimeout(() => {
                document.getElementById('fc-front').textContent = card.front;
                document.getElementById('fc-back').textContent = card.back;
            }, 300);
        } else {
            document.getElementById('fc-front').textContent = card.front;
            document.getElementById('fc-back').textContent = card.back;
        }

        document.getElementById('fc-progress-text').textContent = `Card ${this.currentCardIndex + 1} / ${set.flashcards.length}`;
        document.getElementById('fc-progress-fill').style.width = `${((this.currentCardIndex + 1) / set.flashcards.length) * 100}%`;
    },

    flipCard() {
        const set = State.getActiveSet();
        if (!set || !set.flashcards?.length) return;

        const uiEl = document.getElementById('flashcard');
        this.isFlipped = !this.isFlipped;
        if (this.isFlipped) uiEl.classList.add('is-flipped');
        else uiEl.classList.remove('is-flipped');
    },

    nextCard() {
        const set = State.getActiveSet();
        if (!set || !set.flashcards?.length) return;
        this.currentCardIndex = (this.currentCardIndex + 1) % set.flashcards.length;
        this.renderFlashcard();
    },

    prevCard() {
        const set = State.getActiveSet();
        if (!set || !set.flashcards?.length) return;
        this.currentCardIndex = (this.currentCardIndex - 1 + set.flashcards.length) % set.flashcards.length;
        this.renderFlashcard();
    },

    rateCard(rating) {
        const set = State.getActiveSet();
        if (!set || !set.flashcards?.length) return;

        // update status
        set.flashcards[this.currentCardIndex].status = rating;
        State.updateActiveSet(set);

        // visual feedback
        UI.showToast(`Marked as ${rating}`, 'success');

        // auto advance
        setTimeout(() => this.nextCard(), 400);
    },

    resetFlashcards() {
        const set = State.getActiveSet();
        if (!set || !set.flashcards) return;

        set.flashcards = set.flashcards.map(c => ({ ...c, status: 'unfamiliar' }));
        State.updateActiveSet(set);
        this.currentCardIndex = 0;
        this.renderFlashcard();
        UI.showToast('Progress reset', 'info');
    }
};

// --- QUIZ CONTROLLER ---
const QuizMode = {
    currentQuestionIndex: 0,
    userAnswers: {},
    quizData: [],

    initQuiz(set) {
        this.quizData = set.quiz || [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};

        document.getElementById('quiz-results').style.display = 'none';
        document.querySelector('.quiz-container').style.display = 'block';

        if (this.quizData.length === 0) {
            document.getElementById('quiz-card').innerHTML = "<i>No quiz generated for this set.</i>";
            document.getElementById('quiz-next-btn').style.display = 'none';
        } else {
            this.renderQuestion();
        }
    },

    renderQuestion() {
        const q = this.quizData[this.currentQuestionIndex];
        const card = document.getElementById('quiz-card');

        document.getElementById('quiz-question-counter').textContent = `Question ${this.currentQuestionIndex + 1} of ${this.quizData.length}`;

        const hasAnswered = this.userAnswers[this.currentQuestionIndex] !== undefined;
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        let optionsHTML = q.options.map((opt, idx) => {
            let addClass = '';
            if (hasAnswered) {
                if (opt === q.correctAnswer) addClass = 'correct';
                else if (opt === userAnswer) addClass = 'wrong';
            }

            return `
                <button class="quiz-opt ${addClass}" onclick="QuizMode.selectOption('${opt}')" ${hasAnswered ? 'disabled' : ''}>
                    ${String.fromCharCode(65 + idx)}. ${opt}
                </button>
            `;
        }).join('');

        card.innerHTML = `
            <div class="quiz-question">${q.question}</div>
            <div class="quiz-options">${optionsHTML}</div>
        `;

        // Nav Buttons
        document.getElementById('quiz-prev-btn').disabled = this.currentQuestionIndex === 0;

        const isLast = this.currentQuestionIndex === this.quizData.length - 1;
        document.getElementById('quiz-next-btn').style.display = isLast ? 'none' : 'block';
        document.getElementById('quiz-finish-btn').style.display = isLast ? 'block' : 'none';
    },

    selectOption(optStr) {
        if (this.userAnswers[this.currentQuestionIndex] !== undefined) return;
        this.userAnswers[this.currentQuestionIndex] = optStr;
        this.renderQuestion();
    },

    nextQuestion() {
        if (this.currentQuestionIndex < this.quizData.length - 1) {
            this.currentQuestionIndex++;
            this.renderQuestion();
        }
    },

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderQuestion();
        }
    },

    finishQuiz() {
        let correctCount = 0;
        for (let i = 0; i < this.quizData.length; i++) {
            if (this.userAnswers[i] === this.quizData[i].correctAnswer) {
                correctCount++;
            }
        }

        const percentage = Math.round((correctCount / this.quizData.length) * 100);

        document.querySelector('.quiz-container').style.display = 'none';
        const resEl = document.getElementById('quiz-results');
        resEl.style.display = 'block';

        document.getElementById('quiz-score-display').textContent = `${percentage}%`;

        let feedback = "Good effort!";
        if (percentage >= 90) feedback = "Excellent! You've mastered this material.";
        else if (percentage >= 70) feedback = "Great job! Keep reviewing to reach 100%.";
        else if (percentage < 50) feedback = "Time to hit the flashcards again.";

        document.getElementById('quiz-feedback-text').textContent = feedback;
    },

    startQuiz() {
        const set = State.getActiveSet();
        this.initQuiz(set);
    }
};

// --- AI TUTOR CONTROLLER ---
const Tutor = {
    renderContextDropdown() {
        const select = document.getElementById('chat-context-select');
        const defaultOpt = `<option value="">General (No specific document)</option>`;
        const opts = State.studySets.map(s => `<option value="${s.sourceName}">${s.sourceName}</option>`).join('');
        select.innerHTML = defaultOpt + opts;

        // Select active set if any
        const numSets = State.studySets.length;
        if (State.currentSetId) {
            const actSet = State.getActiveSet();
            if (actSet) select.value = actSet.sourceName;
        } else if (numSets > 0) {
            select.value = State.studySets[0].sourceName;
        }
    },

    handleEnter(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    },

    async sendMessage() {
        const inputStr = document.getElementById('chat-input').value.trim();
        if (!inputStr) return;

        const context = document.getElementById('chat-context-select').value;
        if (!context) {
            UI.showToast('Please select a document context first.', 'warning');
            return;
        }

        // Append user msg
        this.appendMessage('user', inputStr);
        document.getElementById('chat-input').value = '';

        // Append loading...
        const loadingId = this.appendMessage('ai', `<div class="spinner-ring" style="width:20px;height:20px;border-width:2px;margin:0;"></div>`);

        try {
            const replyText = await Api.chatTutor(context, inputStr);
            this.updateMessage(loadingId, replyText);
        } catch (e) {
            this.updateMessage(loadingId, `<span style="color:var(--status-danger)">Error: ${e.message}</span>`);
        }
    },

    appendMessage(role, htmlContent) {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;

        const icon = role === 'ai' ? '<i class="ph-fill ph-robot"></i>' : 'U';

        div.innerHTML = `
            <div class="msg-avatar">${icon}</div>
            <div class="msg-bubble">${htmlContent}</div>
        `;
        const id = 'msg_' + Date.now() + Math.random();
        div.id = id;

        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
        return id;
    },

    updateMessage(id, htmlContent) {
        const div = document.getElementById(id);
        if (div) {
            // Apply simple markdown boldings
            let formatted = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
            formatted = formatted.replace(/\n/g, '<br/>');
            div.querySelector('.msg-bubble').innerHTML = formatted;

            const history = document.getElementById('chat-history');
            history.scrollTop = history.scrollHeight;
        }
    }
};

// --- SETTINGS CONTROLLER ---
const Settings = {
    async loadSettingsPage() {
        const panel = document.getElementById('provider-status-panel');
        panel.textContent = 'Checking AI provider status...';

        const statusData = await Api.checkStatus();
        if (statusData.success) {
            let txt = `Status OK\n`;
            if (statusData.gemini.available) {
                txt += `🟢 Gemini Available (${statusData.gemini.activeModel})\n`;
            } else {
                txt += `🔴 Gemini Unavailable (Check API Key)\n`;
            }
            if (statusData.ollama.available) {
                txt += `🟢 Ollama Local Available\n`;
            } else {
                txt += `🔴 Ollama Offline\n`;
            }
            panel.textContent = txt;
        } else {
            panel.textContent = `Error connecting to backend: ${statusData.error}`;
        }
    },

    async saveKey() {
        const key = document.getElementById('gemini-api-key').value;
        if (!key) return;

        try {
            await Api.setConfigKey(key);
            UI.showToast('API Key saved successfully', 'success');
            document.getElementById('gemini-api-key').value = '';
            this.loadSettingsPage();
        } catch (e) {
            UI.showToast(e.message, 'error');
        }
    },

    clearAllData() {
        if (confirm("Are you sure? This deletes ALL study sets from this browser.")) {
            State.clearAll();
            UI.showToast('Data cleared successfully', 'success');
        }
    }
};

// Boot
window.onload = () => {
    UI.init();
};
