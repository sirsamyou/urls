// script.js
class URLSApp {
    constructor() {
        this.speedrunLevels = [];
        this.hardLevels = [];
        this.profiles = new Map(); // name → {avatar, banner}
        this.creators = new Map();
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

    aggregateCreators() {
        const all = [...this.speedrunLevels, ...this.hardLevels];
        all.forEach(lvl => {
            const c = lvl.creator;
            if (!this.creators.has(c)) this.creators.set(c, { levels: [], total: 0, count: 0 });
            const data = this.creators.get(c);
            data.levels.push(lvl);
            const sum = lvl.type === 'speedrun'
                ? lvl.ratings.gameplay + lvl.ratings.design
                : lvl.ratings.speedrun + lvl.ratings.design + lvl.ratings.difficulty;
            const cnt = lvl.type === 'speedrun' ? 2 : 3;
            data.total += sum / cnt;
            data.count++;
        });
        this.creators.forEach(d => {
            d.avgRating = d.total / d.count;
            d.totalLevels = d.levels.length;
        });
    }

    calculateLeaderboard() {
        const sorted = [...this.creators.entries()].sort(([, a], [, b]) => b.avgRating - a.avgRating);
        sorted.forEach(([, d], i) => d.position = i + 1);
    }

    bindEvents() {
        // navigation
        document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', e => {
            e.preventDefault(); this.switchPage(e.target.dataset.page);
        }));

        // back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchPage(this.lastListPage);
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
        document.getElementById(p).classList.add('active');
        document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`[data-page="${p}"]`);
        if (link) link.classList.add('active');
        if (['speedrun', 'hard', 'leaderboard'].includes(p)) this.lastListPage = p;
        if (p === 'leaderboard') this.renderLeaderboard();
        else if (p === 'speedrun' || p === 'hard') this.renderLevels(p);
        this.currentPage = p;
    }

    filterSort(type, search, sort) {
        let list = type === 'speedrun' ? [...this.speedrunLevels] : [...this.hardLevels];
        if (search) list = list.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase()));
        if (sort === 'rated') {
            list.sort((a, b) => {
                const avgA = Object.values(a.ratings).reduce((s, v) => s + v, 0) / Object.keys(a.ratings).length;
                const avgB = Object.values(b.ratings).reduce((s, v) => s + v, 0) / Object.keys(b.ratings).length;
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
        container.innerHTML = levels.map(l => `
            <div class="level-card" data-id="${l.id}" data-type="${type}">
                <img src="${l.thumbnail}" alt="${l.name}">
                <div class="level-info">
                    <h3>${l.name}</h3>
                    <p><strong>Creator:</strong> <span class="creator-link" data-creator="${l.creator}">${l.creator}</span></p>
                    <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                    <p class="rating">Avg: ${(Object.values(l.ratings).reduce((s, v) => s + v, 0) / Object.keys(l.ratings).length).toFixed(1)}/10</p>
                </div>
            </div>
        `).join('');

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

        const ratings = Object.entries(lvl.ratings).map(([k, v]) => `
            <p><strong>${k.charAt(0).toUpperCase() + k.slice(1)}:</strong> ${v}/10</p>
        `).join('');

        document.getElementById('level-detail-content').innerHTML = `
            <img src="${lvl.thumbnail}" class="level-detail-img" alt="${lvl.name}">
            <div class="level-detail-info">
                <h1>${lvl.name}</h1>
                <p><strong>Creator:</strong> <span class="creator-link" data-creator="${lvl.creator}">${lvl.creator}</span></p>
                <p><strong>Created:</strong> ${new Date(lvl.created).toLocaleDateString()}</p>
                <div class="level-id-bar">
                    <input type="text" value="${lvl.id}" readonly>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${lvl.id}').then(() => alert('ID copied!'))"><i class="fas fa-copy"></i> Copy</button>
                    <a href="${lvl.link}" target="_blank" class="play-btn"><i class="fas fa-play"></i> Play</a>
                </div>
                <div class="ratings"><h3>Ratings</h3>${ratings}</div>
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
                    const avgA = Object.values(a.ratings).reduce((s, v) => s + v, 0) / Object.keys(a.ratings).length;
                    const avgB = Object.values(b.ratings).reduce((s, v) => s + v, 0) / Object.keys(b.ratings).length;
                    return avgB - avgA;
                });
            } else {
                filtered.sort((a, b) => new Date(b.created) - new Date(a.created));
            }
            const grid = document.querySelector('#creator-profile-content .levels-grid');
            grid.innerHTML = filtered.map(l => `
                <div class="level-card" data-id="${l.id}" data-type="${l.type}">
                    <img src="${l.thumbnail}" alt="${l.name}">
                    <div class="level-info">
                        <h3>${l.name}</h3>
                        <p><strong>Type:</strong> ${l.type.charAt(0).toUpperCase() + l.type.slice(1)}</p>
                        <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                        <p class="rating">Avg: ${(Object.values(l.ratings).reduce((s, v) => s + v, 0) / Object.keys(l.ratings).length).toFixed(1)}/10</p>
                    </div>
                </div>
            `).join('');
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
                        <div class="profile-stat"><strong>${data.totalLevels}</strong> Levels</div>
                        <div class="profile-stat"><strong>#${data.position}</strong> Leaderboard</div>
                        <div class="profile-stat"><strong>${data.avgRating.toFixed(1)}/10</strong> Avg Rating</div>
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
        const sorted = [...this.creators.entries()].sort(([, a], [, b]) => b.avgRating - a.avgRating);
        const container = document.getElementById('leaderboard-list');
        container.innerHTML = sorted.map(([c, d]) => `
            <div class="leaderboard-card">
                <div>
                    <h3><span class="creator-link" data-creator="${c}">${c}</span></h3>
                    <p class="avg-rating">Avg: ${d.avgRating.toFixed(1)}/10 | Levels: ${d.totalLevels}</p>
                </div>
                <span class="position">#${d.position}</span>
            </div>
        `).join('');
        container.querySelectorAll('.creator-link').forEach(l => l.addEventListener('click', e => {
            e.preventDefault(); this.showCreatorPage(e.target.dataset.creator);
        }));
    }

    render() {
        this.renderLevels('speedrun');
        this.renderLevels('hard');
        this.renderLeaderboard();
    }
}

document.addEventListener('DOMContentLoaded', () => new URLSApp());
