// script.js
class URLSApp {
    constructor() {
        this.speedrunLevels = [];
        this.hardLevels = [];
        this.profiles = new Map();
        this.creators = new Map();
        this.currentLeaderboard = 'points';
        this.currentPage = 'speedrun';
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
        this.applyInitialVisibility(); // NEW: Show all on load
    }

    async loadData() {
        try {
            this.speedrunLevels = await fetch('speedrun-levels.json').then(r => r.json());
            this.hardLevels = await fetch('hard-levels.json').then(r => r.json());
        } catch (e) { console.error('Load error:', e); }
    }

    async loadProfiles() {
        try {
            const data = await fetch('profiles.json').then(r => r.json());
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

    getRankIcon(rank) {
        if (!rank) return '';
        return `assets/${rank}ranking.png`;
    }

    formatRating(num) {
        return Number(num.toFixed(1));
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

            let sum;
            if (lvl.type === 'speedrun') {
                sum = lvl.ratings.gameplay + lvl.ratings.design + lvl.ratings.speedrunning;
                data.speedrunCount++;
            } else {
                sum = lvl.ratings.speedrun + lvl.ratings.design + lvl.ratings.difficulty;
                data.hardCount++;
            }
            data.totalPoints += sum / 10;
        });
        this.creators.forEach(d => {
            d.totalLevels = d.levels.length;
        });
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
            btn.addEventListener('click', () => {
                this.switchPage(this.lastListPage);
            });
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
            const rated = this.speedrunLevels.filter(l => {
                const total = l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning;
                return total >= 10;
            });
            if (rated.length === 0) return;
            const random = rated[Math.floor(Math.random() * rated.length)];
            this.showLevelPage('speedrun', random.id);
        });

        document.getElementById('random-hard-btn')?.addEventListener('click', () => {
            const rated = this.hardLevels.filter(l => {
                const total = l.ratings.speedrun + l.ratings.design + l.ratings.difficulty;
                return total >= 10;
            });
            if (rated.length === 0) return;
            const random = rated[Math.floor(Math.random() * rated.length)];
            this.showLevelPage('hard', random.id);
        });

        document.body.addEventListener('input', e => {
            if (e.target.id === 'creator-search') {
                const sort = this.filterState.creator.sort;
                this.filterState.creator.search = e.target.value;
                this.renderCreatorLevels(e.target.value, sort);
            }
        });
    }

    switchPage(p) {
        document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
        const target = document.getElementById(p);
        target.classList.add('active');
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
        }, 100);
    }

    renderFAQ() {
        document.getElementById('faq-content').innerHTML = `
            <h1>URLS – Unofficial Rating Levels System</h1>
            <div class="faq-intro">
                <p><strong>URLS</strong> is an <strong>Unofficial Rating Levels System</strong> for community-made levels. Our team of raters evaluates submissions based on gameplay, design, and speedrunning potential (or difficulty for hard levels).</p>
            </div>
            <div class="faq-section">
                <h3>Speedrun Level Rating</h3>
                <p>Speedrun maps are rated on three aspects:</p>
                <ul>
                    <li><strong>Gameplay:</strong> How fun and fluid the level is to play (0–10)</li>
                    <li><strong>Design:</strong> Visuals, layout, creativity (0–10)</li>
                    <li><strong>Speedrunning:</strong> How well it supports speedrun strategies (0–10)</li>
                </ul>
            </div>
            <div class="faq-section">
                <h3>Rank System</h3>
                <p>Only levels with <strong>10+ total points</strong> are ranked:</p>
                <ul>
                    <li><img src="assets/normalranking.png" alt="Normal"> <strong>Normal:</strong> 10 – 17.9 / 30</li>
                    <li><img src="assets/epicranking.png" alt="Epic"> <strong>Epic:</strong> 18 – 22.9 / 30</li>
                    <li><img src="assets/legendaryranking.png" alt="Legendary"> <strong>Legendary:</strong> 23 – 26.9 / 30</li>
                    <li><img src="assets/mythicranking.png" alt="Mythic"> <strong>Mythic:</strong> 27+ / 30</li>
                </ul>
            </div>
            <div class="faq-section">
                <h3>Creator Points</h3>
                <p>Every <strong>10 rating points</strong> a level earns = <strong>1 Creator Point</strong>.</p>
                <p><strong>Example:</strong> A level rated <strong>14/30</strong> gives <strong>1.4 Creator Points</strong>.</p>
                <p>These points are used in the <strong>Creator Points Leaderboard</strong>.</p>
            </div>
            <div class="faq-section">
                <h3>Hard Levels</h3>
                <p>Hard levels use the old system (Speedrun, Design, Difficulty) for now.</p>
            </div>
            <div class="faq-section">
                <h3>Team</h3>
                <div class="team-grid">
                    <div class="team-member">
                        <img src="${this.profiles.get('j89de')?.avatar || 'thumbs/default-avatar.png'}" alt="j89de">
                        <strong>j89de</strong><span>Founder & Rater</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('sqm')?.avatar || 'thumbs/default-avatar.png'}" alt="sqm">
                        <strong>sqm</strong><span>Designer</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('Ripted')?.avatar || 'thumbs/default-avatar.png'}" alt="Ripted">
                        <strong>Ripted</strong><span>Rater & Helper</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('Ch4mpY')?.avatar || 'thumbs/default-avatar.png'}" alt="Ch4mpY">
                        <strong>Ch4mpY</strong><span>Rater</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('Polar')?.avatar || 'thumbs/default-avatar.png'}" alt="Polar">
                        <strong>Polar</strong><span>Rater</span>
                    </div>
                </div>
            </div>
            <div class="faq-section">
                <h3>Submission Rules</h3>
                <p><strong>Important:</strong> Inappropriate, offensive, or rule-breaking levels will not be rated and may be rejected.</p>
            </div>
            <div style="margin-top:2rem;text-align:center;">
                <p style="color:#aaa;font-size:.95rem;">
                    Affiliated with 
                    <a href="https://sirsamyou.github.io/narrowlist/" target="_blank" style="color:#00c6ff;text-decoration:none;">
                        <img src="assets/narrowlist-icon.png" alt="Narrowlist" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;">
                        The Narrowlist
                    </a>
                </p>
            </div>
        `;
        this.applyInitialVisibility();
        this.observeNewCards();
    }

    filterSort(type, search, sort) {
        let list = type === 'speedrun' ? [...this.speedrunLevels] : [...this.hardLevels];
        if (search) list = list.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase()));
        if (sort === 'rated') {
            list.sort((a, b) => {
                const avgA = Object.values(a.ratings).reduce((s, v) => s + v, 0) / 3;
                const avgB = Object.values(b.ratings).reduce((s, v) => s + v, 0) / 3;
                return avgB - avgA;
            });
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
            const ratings = type === 'speedrun'
                ? this.formatRating(l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning)
                : this.formatRating(l.ratings.speedrun + l.ratings.design + l.ratings.difficulty);
            const rank = type === 'speedrun' ? this.getRank(ratings) : null;
            const rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" class="rank-badge" alt="${rank} rank">` : '';
            const profile = this.profiles.get(l.creator) || { avatar: 'thumbs/default-avatar.png' };
            return `
                <div class="level-card" data-id="${l.id}" data-type="${type}" tabindex="0">
                    <img src="${l.thumbnail}" alt="${l.name}" loading="lazy">
                    <div class="level-info">
                        <h3>${l.name}</h3>
                        <div class="creator-info">
                            <span><strong>Creator:</strong></span>
                            <img src="${profile.avatar}" alt="${l.creator}">
                            <span class="creator-link" data-creator="${l.creator}">${l.creator}</span>
                        </div>
                        <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                        <div style="display:flex;align-items:center;gap:.4rem;margin-top:.5rem;">
                            ${rankIcon}
                            <span style="font-size:.85rem;color:#aaa;">${ratings}/30</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.bindCardEvents(container);
        this.applyInitialVisibility();
        this.observeNewCards();
    }

    bindCardEvents(container) {
        container.querySelectorAll('.level-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.classList.contains('creator-link')) return;
                this.showLevelPage(card.dataset.type, card.dataset.id);
            });
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.showLevelPage(card.dataset.type, card.dataset.id);
                }
            });
        });
        container.querySelectorAll('.creator-link').forEach(l => l.addEventListener('click', e => {
            e.stopPropagation(); this.showCreatorPage(e.target.dataset.creator);
        }));
    }

    showLevelPage(type, id) {
        const list = type === 'speedrun' ? this.speedrunLevels : this.hardLevels;
        const lvl = list.find(l => l.id == id);
        if (!lvl) return;

        const profile = this.profiles.get(lvl.creator) || { avatar: 'thumbs/default-avatar.png' };

        let total, rank, rankIcon;
        if (type === 'speedrun') {
            total = this.formatRating(lvl.ratings.gameplay + lvl.ratings.design + lvl.ratings.speedrunning);
            rank = this.getRank(total);
            rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" alt="${rank}">` : '';
        } else {
            total = this.formatRating(lvl.ratings.speedrun + lvl.ratings.design + lvl.ratings.difficulty);
            rank = null;
            rankIcon = '';
        }

        document.getElementById('level-detail-content').innerHTML = `
            <img src="${lvl.thumbnail}" class="level-detail-img" alt="${lvl.name}" loading="lazy">
            <div class="level-detail-info">
                <h1>${lvl.name}</h1>
                <div class="creator-info" style="margin:1rem 0;display:flex;align-items:center;gap:.5rem;">
                    <span><strong>Creator:</strong></span>
                    <img src="${profile.avatar}" alt="${lvl.creator}" style="width:32px;height:32px;border-radius:50%;border:2px solid #00c6ff;cursor:pointer;" class="avatar-click">
                    <span class="creator-link" data-creator="${lvl.creator}" style="font-size:1.1rem;">${lvl.creator}</span>
                </div>
                <p><strong>Created:</strong> ${new Date(lvl.created).toLocaleDateString()}</p>

                ${type === 'speedrun' ? `
                <div class="total-score">
                    ${rankIcon}
                    <span>${total}/30</span>
                </div>
                ` : ''}

                <div class="level-id-bar">
                    <span class="id-label">ID:</span>
                    <input type="text" value="${lvl.id}" readonly aria-label="Level ID">
                    <button class="copy-btn" aria-label="Copy ID">
                        <i class="fas fa-copy"></i> <span>Copy</span>
                    </button>
                    <a href="${lvl.link}" target="_blank" class="play-btn">
                        <i class="fas fa-play"></i> Play
                    </a>
                </div>

                <div class="ratings">
                    <h3>Ratings</h3>
                    ${type === 'speedrun' ? `
                    <div class="rating-item">
                        <span>Gameplay</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.gameplay)}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Design</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.design)}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Speedrunning</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.speedrunning)}/10</span>
                    </div>
                    ` : `
                    <div class="rating-item">
                        <span>Speedrun</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.speedrun)}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Design</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.design)}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Difficulty</span>
                        <span class="rating-value">${this.formatRating(lvl.ratings.difficulty)}/10</span>
                    </div>
                    `}
                </div>
            </div>
        `;

        const copyBtn = document.querySelector('#level-detail-content .copy-btn');
        const copyText = copyBtn.querySelector('span');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(lvl.id);
            copyText.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyText.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 1500);
        });

        document.querySelectorAll('.avatar-click').forEach(img => {
            img.addEventListener('click', e => {
                e.stopPropagation();
                img.classList.add('pulse');
                setTimeout(() => img.classList.remove('pulse'), 600);
            });
        });

        document.querySelector('#level-detail-content .creator-link').addEventListener('click', e => {
            this.showCreatorPage(e.target.dataset.creator);
        });

        this.switchPage('level-detail-page');
    }

    showCreatorPage(name) {
        const data = this.creators.get(name);
        const profile = this.profiles.get(name) || { avatar: 'thumbs/default-avatar.png', banner: 'thumbs/default-banner.jpg' };
        if (!data) return;

        let levels = [...data.levels];
        levels.sort((a, b) => new Date(b.created) - new Date(a.created));

        const renderCreatorLevels = (search = '', sort = 'rated') => {
            let filtered = levels.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
            if (sort === 'rated') {
                filtered.sort((a, b) => {
                    const avgA = Object.values(a.ratings).reduce((s, v) => s + v, 0) / 3;
                    const avgB = Object.values(b.ratings).reduce((s, v) => s + v, 0) / 3;
                    return avgB - avgA;
                });
            } else {
                filtered.sort((a, b) => new Date(b.created) - new Date(a.created));
            }
            const grid = document.querySelector('#creator-profile-content .levels-grid');
            grid.innerHTML = filtered.map(l => {
                const ratings = l.type === 'speedrun'
                    ? this.formatRating(l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning)
                    : this.formatRating(l.ratings.speedrun + l.ratings.design + l.ratings.difficulty);
                const rank = l.type === 'speedrun' ? this.getRank(ratings) : null;
                const rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" class="rank-badge" alt="${rank}">` : '';
                return `
                    <div class="level-card" data-id="${l.id}" data-type="${l.type}" tabindex="0">
                        <img src="${l.thumbnail}" alt="${l.name}" loading="lazy">
                        <div class="level-info">
                            <h3>${l.name}</h3>
                            <p><strong>Type:</strong> ${l.type.charAt(0).toUpperCase() + l.type.slice(1)}</p>
                            <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                            <div style="display:flex;align-items:center;gap:.4rem;margin-top:.5rem;">
                                ${rankIcon}
                                <span style="font-size:.85rem;color:#aaa;">${ratings}/30</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            this.bindCardEvents(grid);
            this.applyInitialVisibility();
            this.observeNewCards();
        };

        document.getElementById('creator-profile-content').innerHTML = `
            <img src="${profile.banner}" class="profile-banner" alt="${name}'s banner" loading="lazy">
            <div class="profile-header">
                <img src="${profile.avatar}" class="profile-pic avatar-click" alt="${name}">
                <div class="profile-info">
                    <h1>${name}</h1>
                    <div class="profile-stats">
                        <div class="profile-stat"><strong>${data.totalPoints.toFixed(2)}</strong> Creator Points</div>
                        <div class="profile-stat"><strong>#${data.posPoints || '-'}</strong> Points Rank</div>
                        <div class="profile-stat"><strong>${data.totalLevels}</strong> Total Maps</div>
                        <div class="profile-stat"><strong>#${data.posTotal || '-'}</strong> Maps Rank</div>
                        <div class="profile-stat"><strong>${data.speedrunCount}</strong> Speedrun</div>
                        <div class="profile-stat"><strong>${data.hardCount}</strong> Hard</div>
                    </div>
                </div>
            </div>
            <div class="creator-levels">
                <h3>Levels</h3>
                <div class="filter-bar">
                    <input type="text" id="creator-search" placeholder="Search…">
                    <div class="sort-btns">
                        <button data-type="creator" data-sort="recent" class="sort-btn">Recent</button>
                        <button data-type="creator" data-sort="rated" class="sort-btn active">Rating</button>
                    </div>
                </div>
                <div class="levels-grid"></div>
            </div>
        `;

        const search = document.getElementById('creator-search');
        const btns = document.querySelectorAll('#creator-profile-content .sort-btn');
        btns.forEach(b => b.addEventListener('click', () => {
            btns.forEach(bb => bb.classList.remove('active'));
            b.classList.add('active');
            this.filterState.creator.sort = b.dataset.sort;
            renderCreatorLevels(search.value, b.dataset.sort);
        }));
        search.addEventListener('input', () => {
            const sort = this.filterState.creator.sort;
            this.filterState.creator.search = search.value;
            renderCreatorLevels(search.value, sort);
        });

        document.querySelectorAll('.avatar-click').forEach(img => {
            img.addEventListener('click', e => {
                e.stopPropagation();
                img.classList.add('pulse');
                setTimeout(() => img.classList.remove('pulse'), 600);
            });
        });

        renderCreatorLevels(this.filterState.creator.search, this.filterState.creator.sort);
        this.switchPage('creator-profile-page');
    }

    renderLeaderboard() {
        let sorted = [];
        const type = this.currentLeaderboard;

        if (type === 'points') {
            sorted = [...this.creators.entries()].sort(([,a],[,b]) => b.totalPoints - a.totalPoints);
        } else if (type === 'total') {
            sorted = [...this.creators.entries()].sort(([,a],[,b]) => b.totalLevels - a.totalLevels);
        } else if (type === 'speedrun') {
            sorted = [...this.creators.entries()].filter(([,d]) => d.speedrunCount > 0).sort(([,a],[,b]) => b.speedrunCount - a.speedrunCount);
        } else if (type === 'hard') {
            sorted = [...this.creators.entries()].filter(([,d]) => d.hardCount > 0).sort(([,a],[,b]) => b.hardCount - a.hardCount);
        }

        const container = document.getElementById('leaderboard-list');
        container.innerHTML = sorted.map(([name, d], i) => {
            const profile = this.profiles.get(name) || { avatar: 'thumbs/default-avatar.png', banner: 'thumbs/default-banner.jpg' };
            let value = '';
            if (type === 'points') value = `${d.totalPoints.toFixed(2)} CP`;
            else if (type === 'total') value = `${d.totalLevels} Maps`;
            else if (type === 'speedrun') value = `${d.speedrunCount} Speedrun`;
            else if (type === 'hard') value = `${d.hardCount} Hard`;

            return `
                <div class="leaderboard-card" data-creator="${name}" tabindex="0">
                    <img src="${profile.banner}" class="leaderboard-banner" alt="${name}'s banner" loading="lazy">
                    <div class="leaderboard-content">
                        <div class="leaderboard-info">
                            <img src="${profile.avatar}" class="leaderboard-avatar" alt="${name}">
                            <div>
                                <h3><span class="creator-link" data-creator="${name}">${name}</span></h3>
                                <p class="avg-rating">${value}</p>
                            </div>
                        </div>
                        <span class="position">#${i + 1}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.leaderboard-card').forEach(card => {
            card.addEventListener('click', () => this.showCreatorPage(card.dataset.creator));
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.showCreatorPage(card.dataset.creator);
                }
            });
        });

        this.applyInitialVisibility();
        this.observeNewCards();
    }

    // NEW: Show visible cards immediately, animate only off-screen ones
    applyInitialVisibility() {
        requestAnimationFrame(() => {
            document.querySelectorAll('.level-card, .leaderboard-card').forEach(card => {
                const rect = card.getBoundingClientRect();
                const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
                if (isVisible) {
                    card.classList.add('animate-in');
                } else {
                    card.classList.add('animate-ready');
                }
            });
        });
    }

    initScrollAnimation() {
        if (this.observer) this.observer.disconnect();

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    }

    observeNewCards() {
        if (!this.observer) this.initScrollAnimation();
        document.querySelectorAll('.animate-ready').forEach(el => {
            el.classList.remove('animate-in');
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
