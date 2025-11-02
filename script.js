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
        this.init();
    }

    async init() {
        await this.loadData();
        await this.loadProfiles();
        this.aggregateCreators();
        this.calculateLeaderboard();
        this.render();
        this.bindEvents();
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
        // URLS logo → FAQ
        document.getElementById('urls-logo').addEventListener('click', e => {
            e.preventDefault();
            this.switchPage('faq');
        });

        // hamburger
        document.querySelector('.hamburger').addEventListener('click', () => {
            document.querySelector('.nav').classList.toggle('active');
        });

        // navigation
        document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', e => {
            e.preventDefault(); this.switchPage(e.target.dataset.page);
            document.querySelector('.nav').classList.remove('active');
        }));

        // back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchPage(this.lastListPage);
            });
        });

        // leaderboard tabs
        document.querySelectorAll('.lb-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentLeaderboard = tab.dataset.lb;
                this.renderLeaderboard();
            });
        });

        // sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const sort = btn.dataset.sort;
                document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const searchEl = document.getElementById(`${type}-search`);
                this.filterSort(type, searchEl ? searchEl.value : '', sort);
            });
        });

        // search
        ['speedrun', 'hard'].forEach(type => {
            const el = document.getElementById(`${type}-search`);
            if (el) el.addEventListener('input', e => {
                const sort = document.querySelector(`.sort-btn[data-type="${type}"].active`).dataset.sort;
                this.filterSort(type, e.target.value, sort);
            });
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
                        <img src="${this.profiles.get('Ch4mpY')?.avatar || 'thumbs/default-avatar.png'}" alt="Ch4mpY">
                        <strong>Ch4mpY</strong><span>Rater</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('Polar')?.avatar || 'thumbs/default-avatar.png'}" alt="Polar">
                        <strong>Polar</strong><span>Rater</span>
                    </div>
                    <div class="team-member">
                        <img src="${this.profiles.get('Ripted')?.avatar || 'thumbs/default-avatar.png'}" alt="Ripted">
                        <strong>Ripted</strong><span>Rater</span>
                    </div>
                </div>
            </div>

            <p style="margin-top:2rem;font-style:italic;text-align:center;">Made with passion for the community</p>
        `;
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

    renderLevels(type) { this.filterSort(type, '', 'recent'); }

    renderList(type, levels) {
        const container = document.getElementById(type === 'speedrun' ? 'speedrun-list' : 'hard-list');
        container.innerHTML = levels.map(l => {
            const ratings = type === 'speedrun'
                ? l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning
                : l.ratings.speedrun + l.ratings.design + l.ratings.difficulty;
            const rank = type === 'speedrun' ? this.getRank(ratings) : null;
            const rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" class="rank-badge" alt="${rank} rank">` : '';
            const profile = this.profiles.get(l.creator) || { avatar: 'thumbs/default-avatar.png' };
            return `
                <div class="level-card" data-id="${l.id}" data-type="${type}">
                    <img src="${l.thumbnail}" alt="${l.name}">
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

        container.querySelectorAll('.level-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.classList.contains('creator-link')) return;
                this.showLevelPage(card.dataset.type, card.dataset.id);
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
            total = lvl.ratings.gameplay + lvl.ratings.design + lvl.ratings.speedrunning;
            rank = this.getRank(total);
            rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" alt="${rank}">` : '';
        } else {
            total = lvl.ratings.speedrun + lvl.ratings.design + lvl.ratings.difficulty;
            rank = null;
            rankIcon = '';
        }

        document.getElementById('level-detail-content').innerHTML = `
            <img src="${lvl.thumbnail}" class="level-detail-img" alt="${lvl.name}">
            <div class="level-detail-info">
                <h1>${lvl.name}</h1>
                <div class="creator-info" style="margin:1rem 0;display:flex;align-items:center;gap:.5rem;">
                    <span><strong>Creator:</strong></span>
                    <img src="${profile.avatar}" alt="${lvl.creator}" style="width:32px;height:32px;border-radius:50%;border:2px solid #00c6ff;">
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
                    <input type="text" value="${lvl.id}" readonly>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${lvl.id}')">
                        <i class="fas fa-copy"></i> Copy
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
                        <span class="rating-value">${lvl.ratings.gameplay}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Design</span>
                        <span class="rating-value">${lvl.ratings.design}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Speedrunning</span>
                        <span class="rating-value">${lvl.ratings.speedrunning}/10</span>
                    </div>
                    ` : `
                    <div class="rating-item">
                        <span>Speedrun</span>
                        <span class="rating-value">${lvl.ratings.speedrun}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Design</span>
                        <span class="rating-value">${lvl.ratings.design}/10</span>
                    </div>
                    <div class="rating-item">
                        <span>Difficulty</span>
                        <span class="rating-value">${lvl.ratings.difficulty}/10</span>
                    </div>
                    `}
                </div>
            </div>
        `;

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

        const renderLevels = (search = '', sort = 'recent') => {
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
                    ? l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning
                    : l.ratings.speedrun + l.ratings.design + l.ratings.difficulty;
                const rank = l.type === 'speedrun' ? this.getRank(ratings) : null;
                const rankIcon = rank ? `<img src="${this.getRankIcon(rank)}" class="rank-badge" alt="${rank}">` : '';
                return `
                    <div class="level-card" data-id="${l.id}" data-type="${l.type}">
                        <img src="${l.thumbnail}" alt="${l.name}">
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
            grid.querySelectorAll('.level-card').forEach(c => c.addEventListener('click', () => {
                this.showLevelPage(c.dataset.type, c.dataset.id);
            }));
        };

        document.getElementById('creator-profile-content').innerHTML = `
            <img src="${profile.banner}" class="profile-banner" alt="${name}'s banner">
            <div class="profile-header">
                <img src="${profile.avatar}" class="profile-pic" alt="${name}">
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
                        <button data-type="creator" data-sort="recent" class="sort-btn active"><i class="fas fa-clock"></i> Recent</button>
                        <button data-type="creator" data-sort="rated" class="sort-btn"><i class="fas fa-star"></i> Rating</button>
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
            renderLevels(search.value, b.dataset.sort);
        }));
        search.addEventListener('input', () => {
            const sort = document.querySelector('#creator-profile-content .sort-btn.active').dataset.sort;
            renderLevels(search.value, sort);
        });
        renderLevels();

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
                <div class="leaderboard-card" data-creator="${name}">
                    <img src="${profile.banner}" class="leaderboard-banner" alt="${name}'s banner">
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
            card.addEventListener('click', () => {
                this.showCreatorPage(card.dataset.creator);
            });
        });
    }

    render() {
        this.renderLevels('speedrun');
        this.renderLevels('hard');
        this.renderLeaderboard();
    }
}

document.addEventListener('DOMContentLoaded', () => new URLSApp());
