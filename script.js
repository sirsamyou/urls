// script.js
class URLSApp {
    constructor() {
        this.speedrunLevels = [];
        this.hardLevels = [];
        this.profiles = new Map();
        this.creators = new Map();
        this.currentLeaderboard = 'points';
        this.lastListPage = 'speedrun';
        this.filterState = {
            speedrun: { search: '', sort: 'rated' },
            hard: { search: '', sort: 'rated' },
            creator: { search: '', sort: 'rated' }
        };
        this.observer = null;
        this.init();
    }

    async init() {
        await this.loadData();
        await this.loadProfiles();
        this.aggregateCreators();
        this.calculateLeaderboard();
        this.render();
        this.bindEvents();
        this.initScrollAnimation();
        this.applyInitialVisibility();
    }

    async loadData() {
        const proxy = 'https://api.allorigins.ml/get?method=raw&url=';
        try {
            const speedrunUrl = `${proxy}${encodeURIComponent('https://urls.gd/speedrun-levels.json')}`;
            const hardUrl = `${proxy}${encodeURIComponent('https://urls.gd/hard-levels.json')}`;
            this.speedrunLevels = await fetch(speedrunUrl).then(r => r.json());
            this.hardLevels = await fetch(hardUrl).then(r => r.json());
        } catch (e) {
            console.error('Load error:', e);
            document.body.insertAdjacentHTML('beforeend', '<div style="color:red;padding:2rem;text-align:center;">Failed to load levels. Check console or try again later.</div>');
        }
    }

    async loadProfiles() {
        const proxy = 'https://api.allorigins.ml/get?method=raw&url=';
        try {
            const url = `${proxy}${encodeURIComponent('https://urls.gd/profiles.json')}`;
            const data = await fetch(url).then(r => r.json());
            data.forEach(p => this.profiles.set(p.name, { avatar: p.avatar, banner: p.banner }));
        } catch (e) { console.error('Profiles load error:', e); }
    }

    getRank(total) {
        if (total < 10) return null;
        if (total < 18) return 'normal';
        if (total < 23) return 'epic';
        if (total < 27) return 'legendary';
        return 'mythic';
    }

    getRankIcon(rank, isHard = false) {
        if (!rank) return '';
        const suffix = isHard ? 'hard' : '';
        return `assets/${rank}ranking${suffix}.png`;
    }

    formatRating(num) {
        return Number(num.toFixed(1));
    }

    getTotalRating(level) {
        if (level.type === 'speedrun') {
            return level.ratings.gameplay + level.ratings.design + level.ratings.speedrunning;
        } else {
            return level.ratings.gameplay + level.ratings.design + level.ratings.balancing;
        }
    }

    aggregateCreators() {
        const all = [...this.speedrunLevels, ...this.hardLevels];
        all.forEach(lvl => {
            const c = lvl.creator;
            if (!this.creators.has(c)) {
                this.creators.set(c, {
                    levels: [], totalPoints: 0, speedrunCount: 0, hardCount: 0
                });
            }
            const data = this.creators.get(c);
            data.levels.push(lvl);
            const sum = this.getTotalRating(lvl);
            data.totalPoints += sum / 10;
            if (lvl.type === 'speedrun') data.speedrunCount++;
            else data.hardCount++;
        });
        this.creators.forEach(d => d.totalLevels = d.levels.length);
    }

    calculateLeaderboard() {
        const creators = [...this.creators.entries()];
        const byPoints = creators.sort(([,a],[,b]) => b.totalPoints - a.totalPoints);
        byPoints.forEach(([name], i) => this.creators.get(name).posPoints = i + 1);

        const byTotal = creators.sort(([,a],[,b]) => b.totalLevels - a.totalLevels);
        byTotal.forEach(([name], i) => this.creators.get(name).posTotal = i + 1);

        const bySpeedrun = creators.filter(([,d]) => d.speedrunCount > 0).sort(([,a],[,b]) => b.speedrunCount - a.speedrunCount);
        bySpeedrun.forEach(([name], i) => this.creators.get(name).posSpeedrun = i + 1);

        const byHard = creators.filter(([,d]) => d.hardCount > 0).sort(([,a],[,b]) => b.hardCount - a.hardCount);
        byHard.forEach(([name], i) => this.creators.get(name).posHard = i + 1);
    }

    bindEvents() {
        document.getElementById('urls-logo').addEventListener('click', e => {
            e.preventDefault();
            this.switchPage('faq');
        });

        document.querySelector('.hamburger').addEventListener('click', () => {
            document.querySelector('.nav').classList.toggle('active');
        });

        document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', e => {
            e.preventDefault(); this.switchPage(e.target.dataset.page);
            document.querySelector('.nav').classList.remove('active');
        }));

        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchPage(this.lastListPage));
        });

        document.querySelectorAll('.lb-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentLeaderboard = tab.dataset.lb;
                this.renderLeaderboard();
            });
        });

        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const sort = btn.dataset.sort;
                document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const searchEl = document.getElementById(`${type}-search`) || document.getElementById('creator-search');
                const search = searchEl ? searchEl.value : '';
                this.filterState[type].sort = sort;
                this.filterState[type].search = search;
                this.filterSort(type, search, sort);
            });
        });

        ['speedrun', 'hard'].forEach(type => {
            const el = document.getElementById(`${type}-search`);
            if (el) el.addEventListener('input', e => {
                const sort = this.filterState[type].sort;
                this.filterState[type].search = e.target.value;
                this.filterSort(type, e.target.value, sort);
            });
        });

        document.getElementById('random-speedrun-btn')?.addEventListener('click', () => {
            const rated = this.speedrunLevels.filter(l => this.getTotalRating(l) >= 10);
            if (!rated.length) return;
            const random = rated[Math.floor(Math.random() * rated.length)];
            this.showLevelPage('speedrun', random.id);
        });

        document.getElementById('random-hard-btn')?.addEventListener('click', () => {
            const rated = this.hardLevels.filter(l => this.getTotalRating(l) >= 10);
            if (!rated.length) return;
            const random = rated[Math.floor(Math.random() * rated.length)];
            this.showLevelPage('hard', random.id);
        });

        document.body.addEventListener('input', e => {
            if (e.target.id === 'creator-search') {
                this.renderCreatorLevels(e.target.value, this.filterState.creator.sort);
            }
        });
    }

    switchPage(p) {
        document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
        document.getElementById(p).classList.add('active');
        document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`[data-page="${p}"]`);
        if (link) link.classList.add('active');
        if (['speedrun', 'hard', 'leaderboard', 'submit', 'faq'].includes(p)) this.lastListPage = p;
        if (p === 'leaderboard') this.renderLeaderboard();
        else if (p === 'speedrun' || p === 'hard') this.renderLevels(p);
        else if (p === 'faq') this.renderFAQ();
        this.currentPage = p;

        setTimeout(() => {
            this.applyInitialVisibility();
            this.observeNewCards();
        }, 150);
    }

    renderFAQ() {
        document.getElementById('faq-content').innerHTML = `
            <h1>URLS – Unofficial Rating Levels System</h1>
            <div class="faq-intro">
                <p><strong>URLS</strong> is a community-driven rating system for Geometry Dash levels. Both Speedrun and Hard levels now use the same modern 3-category system.</p>
            </div>

            <div class="faq-section">
                <h3><img src="assets/speedrun-icon.png" alt=""> Speedrun Level Rating</h3>
                <ul>
                    <li><strong>Gameplay:</strong> Fun & fluidity (0–10)</li>
                    <li><strong>Design:</strong> Visuals & creativity (0–10)</li>
                    <li><strong>Speedrunning:</strong> Tech & route potential (0–10)</li>
                </ul>
            </div>

            <div class="faq-section">
                <h3><img src="assets/hard-icon.png" alt=""> Hard Level Rating (NEW!)</h3>
                <p>Same structure as speedrun levels:</p>
                <ul>
                    <li><strong>Gameplay:</strong> Fun & challenge (0–10)</li>
                    <li><strong>Design:</strong> Visuals & layout (0–10)</li>
                    <li><strong>Balancing:</strong> Fair difficulty curve (0–10)</li>
                </ul>
            </div>

            <div class="faq-section">
                <h3>Rank System (Both Types)</h3>
                <p>Only levels with <strong>10+ total points</strong> are ranked:</p>
                <ul>
                    <li><img src="assets/normalranking.png" alt="" class="rank-badge"> <strong>Normal:</strong> 10–17.9 (Speedrun) | <img src="assets/normalrankinghard.png" alt="" class="rank-badge"> (Hard)</li>
                    <li><img src="assets/epicranking.png" alt="" class="rank-badge"> <strong>Epic:</strong> 18–22.9 | <img src="assets/epicrankinghard.png" alt="" class="rank-badge"> (Hard)</li>
                    <li><img src="assets/legendaryranking.png" alt="" class="rank-badge"> <strong>Legendary:</strong> 23–26.9 | <img src="assets/legendaryrankinghard.png" alt="" class="rank-badge"> (Hard)</li>
                    <li><img src="assets/mythicranking.png" alt="" class="rank-badge"> <strong>Mythic:</strong> 27+ | <img src="assets/mythicrankinghard.png" alt="" class="rank-badge"> (Hard)</li>
                </ul>
            </div>

            <div class="faq-section">
                <h3>Creator Points</h3>
                <p>Every <strong>10 rating points</strong> = <strong>1 Creator Point</strong>. Used in the Points Leaderboard.</p>
            </div>

            <div class="faq-section">
                <h3>Team</h3>
                <div class="team-grid">
                    ${['j89de','sqm','Ripted','Ch4mpY','Polar'].map(name => `
                    <div class="team-member">
                        <img src="${this.profiles.get(name)?.avatar || 'thumbs/default-avatar.png'}" alt="${name}">
                        <strong>${name}</strong><span>${name === 'j89de' ? 'Founder & Rater' : name === 'sqm' ? 'Designer' : 'Rater'}</span>
                    </div>`).join('')}
                </div>
            </div>
        `;
    }

    filterSort(type, search, sort) {
        let list = type === 'speedrun' ? [...this.speedrunLevels] : [...this.hardLevels];
        if (search) list = list.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase()));
        if (sort === 'rated') {
            list.sort((a, b) => this.getTotalRating(b) - this.getTotalRating(a));
        } else {
            list.sort((a, b) => new Date(b.created) - new Date(a.created));
        }
        this.renderList(type, list);
    }

    renderLevels(type) {
        const state = this.filterState[type];
        this.filterSort(type, state.search, state.sort);
        document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.sort === state.sort);
        });
    }

    renderList(type, levels) {
        const container = document.getElementById(type === 'speedrun' ? 'speedrun-list' : 'hard-list');
        container.innerHTML = levels.map(l => {
            const total = this.formatRating(this.getTotalRating(l));
            const rank = this.getRank(total);
            const isHard = type === 'hard';
            const rankIcon = rank ? `<img src="${this.getRankIcon(rank, isHard)}" class="rank-badge" alt="${rank}">` : '';
            const profile = this.profiles.get(l.creator) || { avatar: 'thumbs/default-avatar.png' };
            return `
                <div class="level-card" data-id="${l.id}" data-type="${type}" tabindex="0">
                    <img src="${l.thumbnail}" alt="${l.name}" loading="lazy">
                    <div class="level-info">
                        <h3>${l.name}</h3>
                        <div class="creator-info">
                            <img src="${profile.avatar}" alt="${l.creator}">
                            <span class="creator-link" data-creator="${l.creator}">${l.creator}</span>
                        </div>
                        <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                        <div style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;">
                            ${rankIcon}
                            <span style="font-size:.9rem;color:#aaa;">${total}/30</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.bindCardEvents(container);
        this.applyInitialVisibility();
        this.observeNewCards();
    }

    showLevelPage(type, id) {
        const list = type === 'speedrun' ? this.speedrunLevels : this.hardLevels;
        const lvl = list.find(l => l.id == id);
        if (!lvl) return;

        const total = this.formatRating(this.getTotalRating(lvl));
        const rank = this.getRank(total);
        const isHard = type === 'hard';
        const rankIcon = rank ? `<img src="${this.getRankIcon(rank, isHard)}" class="rank-badge" alt="${rank}">` : '';

        const profile = this.profiles.get(lvl.creator) || { avatar: 'thumbs/default-avatar.png' };

        document.getElementById('level-detail-content').innerHTML = `
            <img src="${lvl.thumbnail}" class="level-detail-img" alt="${lvl.name}" loading="lazy">
            <div class="level-detail-info">
                <h1>${lvl.name}</h1>
                <div class="creator-info" style="margin:1rem 0;">
                    <img src="${profile.avatar}" alt="${lvl.creator}" class="avatar-click" style="width:36px;height:36px;">
                    <span class="creator-link" data-creator="${lvl.creator}">${lvl.creator}</span>
                </div>
                <p><strong>Created:</strong> ${new Date(lvl.created).toLocaleDateString()}</p>

                <div class="total-score">
                    ${rankIcon}
                    <span>${total}/30</span>
                </div>

                <div class="level-id-bar">
                    <span class="id-label">ID:</span>
                    <input type="text" value="${lvl.id}" readonly>
                    <button class="copy-btn"><i class="fas fa-copy"></i> <span>Copy</span></button>
                    <a href="${lvl.link}" target="_blank" class="play-btn"><i class="fas fa-play"></i> Play</a>
                </div>

                <div class="ratings">
                    <h3>Ratings</h3>
                    ${type === 'speedrun' ? `
                    <div class="rating-item"><span>Gameplay</span><span class="rating-value">${this.formatRating(lvl.ratings.gameplay)}/10</span></div>
                    <div class="rating-item"><span>Design</span><span class="rating-value">${this.formatRating(lvl.ratings.design)}/10</span></div>
                    <div class="rating-item"><span>Speedrunning</span><span class="rating-value">${this.formatRating(lvl.ratings.speedrunning)}/10</span></div>
                    ` : `
                    <div class="rating-item"><span>Gameplay</span><span class="rating-value">${this.formatRating(lvl.ratings.gameplay)}/10</span></div>
                    <div class="rating-item"><span>Design</span><span class="rating-value">${this.formatRating(lvl.ratings.design)}/10</span></div>
                    <div class="rating-item"><span>Balancing</span><span class="rating-value">${this.formatRating(lvl.ratings.balancing)}/10</span></div>
                    `}
                </div>
            </div>
        `;

        this.switchPage('level-detail-page');
    }

    applyInitialVisibility() {
        requestAnimationFrame(() => {
            document.querySelectorAll('.level-card').forEach(card => {
                card.style.opacity = '1';
                card.style.transform = 'none';
            });
            document.querySelectorAll('.leaderboard-card').forEach((card, i) => {
                card.style.transitionDelay = `${i * 0.1}s`;
                card.classList.add('visible');
            });
        });
    }

    initScrollAnimation() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.15 });
    }

    observeNewCards() {
        if (!this.observer) this.initScrollAnimation();
        document.querySelectorAll('.leaderboard-card:not(.visible)').forEach(el => {
            this.observer.observe(el);
        });
    }

    render() {
        this.renderLevels('speedrun');
        this.renderLevels('hard');
        this.renderLeaderboard();
    }
}

document.addEventListener('DOMContentLoaded', () => new URLSApp());
