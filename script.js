class URLSApp {
    constructor() {
        this.speedrunLevels = []; this.hardLevels = []; this.profiles = new Map(); this.creators = new Map();
        this.currentLeaderboard = 'points'; this.lastListPage = 'speedrun';
        this.filterState = { speedrun: { search: '', sort: 'rated' }, hard: { search: '', sort: 'rated' }, creator: { search: '', sort: 'rated' } };
        this.observer = null; this.init();
    }

    async init() {
        this.showLoading();
        await this.loadData();
        await this.loadProfiles();
        this.aggregateCreators();
        this.calculateLeaderboard();
        this.render();
        this.bindEvents();
        this.initScrollAnimation();
        this.applyInitialVisibility();
        this.hideLoading();
    }

    showLoading() {
        document.querySelectorAll('.levels-grid, #leaderboard-list').forEach(c => {
            c.innerHTML = Array(12).fill `<div class="level-card skeleton"></div>`.join('');
        });
        document.getElementById('leaderboard-list').innerHTML = Array(20).fill `<div class="leaderboard-card skeleton"></div>`.join('');
    }

    hideLoading() { document.querySelectorAll('.skeleton').forEach(el => el.remove()); }

    async loadData() {
        try {
            const [s, h] = await Promise.all([
                fetch('speedrun-levels.json').then(r => r.ok ? r.json() : Promise.reject()),
                fetch('hard-levels.json').then(r => r.ok ? r.json() : Promise.reject())
            ]);
            this.speedrunLevels = s; this.hardLevels = h;
        } catch (e) {
            document.body.insertAdjacentHTML('beforeend', '<div style="color:red;padding:2rem;text-align:center;background:#300;">Failed to load levels. Make sure speedrun-levels.json and hard-levels.json are in the root of your repo.</div>');
        }
    }

    async loadProfiles() {
        try {
            const data = await fetch('profiles.json').then(r => r.ok ? r.json() : []);
            data.forEach(p => this.profiles.set(p.name, { avatar: p.avatar || 'thumbs/default-avatar.png', banner: p.banner || 'assets/default-banner.jpg' }));
        } catch (e) { console.error('Profiles error:', e); }
    }

    getRank(total) { if (total < 10) return null; if (total < 18) return 'normal'; if (total < 23) return 'epic'; if (total < 27) return 'legendary'; return 'mythic'; }
    getRankIcon(rank, isHard = false) { return `assets/${rank}ranking${isHard ? 'hard' : ''}.png`; }
    formatRating(num) { return Number(num.toFixed(1)); }
    getTotalRating(l) { return l.type === 'speedrun' ? l.ratings.gameplay + l.ratings.design + l.ratings.speedrunning : l.ratings.gameplay + l.ratings.design + l.ratings.balancing; }

    aggregateCreators() {
        [...this.speedrunLevels, ...this.hardLevels].forEach(lvl => {
            const c = lvl.creator;
            if (!this.creators.has(c)) this.creators.set(c, { levels: [], totalPoints: 0, speedrunCount: 0, hardCount: 0 });
            const d = this.creators.get(c); d.levels.push(lvl);
            d.totalPoints += this.getTotalRating(lvl) / 10;
            l.type === 'speedrun' ? d.speedrunCount++ : d.hardCount++;
        });
        this.creators.forEach(d => d.totalLevels = d.levels.length);
    }

    calculateLeaderboard() {
        const creators = [...this.creators.entries()];
        const sorts = {
            points: () => creators.sort(([,a],[,b]) => b.totalPoints - a.totalPoints),
            total: () => creators.sort(([,a],[,b]) => b.totalLevels - a.totalLevels),
            speedrun: () => creators.filter(([,d]) => d.speedrunCount > 0).sort(([,a],[,b]) => b.speedrunCount - a.speedrunCount),
            hard: () => creators.filter(([,d]) => d.hardCount > 0).sort(([,a],[,b]) => b.hardCount - a.hardCount)
        };
        Object.keys(sorts).forEach(key => {
            sorts[key]().forEach(([name], i) => this.creators.get(name)[`pos${key.charAt(0).toUpperCase() + key.slice(1)}`] = i + 1);
        });
    }

    bindEvents() {
        document.getElementById('urls-logo').onclick = e => { e.preventDefault(); this.switchPage('speedrun'); };
        document.querySelector('.hamburger').onclick = () => document.querySelector('.nav').classList.toggle('active');
        document.querySelectorAll('.nav a').forEach(a => a.onclick = e => { e.preventDefault(); this.switchPage(a.dataset.page); document.querySelector('.nav').classList.remove('active'); });
        document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => this.switchPage(this.lastListPage));
        document.querySelectorAll('.lb-tab').forEach(t => t.onclick = () => { document.querySelectorAll('.lb-tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); this.currentLeaderboard = t.dataset.lb; this.renderLeaderboard(); });
        document.querySelectorAll('.sort-btn').forEach(b => b.onclick = () => { const type = b.dataset.type; document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(x => x.classList.remove('active')); b.classList.add('active'); this.filterState[type].sort = b.dataset.sort; this.filterSort(type, document.getElementById(`${type}-search`).value, b.dataset.sort); });
        ['speedrun','hard'].forEach(t => document.getElementById(`${t}-search`).oninput = e => { this.filterState[t].search = e.target.value; this.filterSort(t, e.target.value, this.filterState[t].sort); });
        document.getElementById('random-speedrun-btn').onclick = () => { const r = this.speedrunLevels.filter(l => this.getTotalRating(l) >= 10); if(r.length) this.showLevelPage('speedrun', r[Math.floor(Math.random()*r.length)].id); };
        document.getElementById('random-hard-btn').onclick = () => { const r = this.hardLevels.filter(l => this.getTotalRating(l) >= 10); if(r.length) this.showLevelPage('hard', r[Math.floor(Math.random()*r.length)].id); };
    }

    switchPage(p) {
        document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
        document.getElementById(p).classList.add('active');
        document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`[data-page="${p}"]`); if(link) link.classList.add('active');
        if(['speedrun','hard','leaderboard','submit','faq'].includes(p)) this.lastListPage = p;
        if(p==='leaderboard') this.renderLeaderboard();
        else if(p==='speedrun'||p==='hard') this.renderLevels(p);
        else if(p==='faq') this.renderFAQ();
        setTimeout(() => { this.applyInitialVisibility(); this.observeNewCards(); }, 150);
    }

    renderFAQ() {
        document.getElementById('faq-content').innerHTML = `...`; // keep your original FAQ HTML
    }

    filterSort(type, search, sort) {
        let list = type === 'speedrun' ? [...this.speedrunLevels] : [...this.hardLevels];
        if(search) list = list.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase()));
        list.sort((a,b) => sort==='rated' ? this.getTotalRating(b)-this.getTotalRating(a) : new Date(b.created)-new Date(a.created));
        this.renderList(type, list);
    }

    renderLevels(type) { this.filterSort(type, this.filterState[type].search, this.filterState[type].sort); }

    bindCardEvents(container) {
        container.querySelectorAll('.level-card').forEach(c => c.onclick = () => this.showLevelPage(c.dataset.type, c.dataset.id));
        container.querySelectorAll('.creator-link').forEach(l => l.onclick = e => { e.stopPropagation(); this.showCreatorProfile(l.dataset.creator); });
    }

    renderList(type, levels) {
        const container = document.getElementById(type+'-list');
        container.innerHTML = levels.map(l => {
            const total = this.formatRating(this.getTotalRating(l));
            const rank = this.getRank(total);
            const isHard = type === 'hard';
            const rankIcon = rank ? `<img src="${this.getRankIcon(rank, isHard)}" class="rank-badge">` : '';
            const profile = this.profiles.get(l.creator) || { avatar: 'thumbs/default-avatar.png' };
            return `<div class="level-card" data-id="${l.id}" data-type="${type}">
                <img src="thumbs/${l.thumbnail}" loading="lazy">
                <div class="level-info"><h3>${l.name}</h3>
                    <div class="creator-info"><img src="${profile.avatar}"><span class="creator-link" data-creator="${l.creator}">${l.creator}</span></div>
                    <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                    <div style="display:flex;gap:.5rem;align-items:center;">${rankIcon}<span style="color:#aaa;font-size:.9rem;">${total}/30</span></div>
                </div>
            </div>`;
        }).join('');
        this.bindCardEvents(container); this.applyInitialVisibility(); this.observeNewCards();
    }

    showLevelPage(type, id) {
        const lvl = (type==='speedrun' ? this.speedrunLevels : this.hardLevels).find(l => l.id == id);
        if(!lvl) return;
        const total = this.formatRating(this.getTotalRating(lvl));
        const rank = this.getRank(total);
        const isHard = type==='hard';
        const rankIcon = rank ? `<img src="${this.getRankIcon(rank, isHard)}" class="rank-badge">` : '';
        const profile = this.profiles.get(lvl.creator) || { avatar: 'thumbs/default-avatar.png' };
        document.getElementById('level-detail-content').innerHTML = `...`; // full detail HTML with thumbs/${lvl.thumbnail}
        document.querySelectorAll('.copy-btn').forEach(b => b.onclick = () => { navigator.clipboard.writeText(lvl.id); b.querySelector('span').textContent='Copied!'; setTimeout(() => b.querySelector('span').textContent='Copy',2000); });
        document.querySelectorAll('[data-creator]').forEach(el => el.onclick = () => this.showCreatorProfile(el.dataset.creator));
        this.switchPage('level-detail-page');
    }

    showCreatorProfile(name) {
        const data = this.creators.get(name);
        if(!data) return;
        const profile = this.profiles.get(name) || { avatar: 'thumbs/default-avatar.png', banner: 'assets/default-banner.jpg' };
        document.getElementById('creator-profile-content').innerHTML = `...`; // full profile HTML
        this.renderCreatorLevels('', 'rated');
        this.switchPage('creator-profile-page');
    }

    renderCreatorLevels(search, sort) { /* same as before */ }
    renderLeaderboard() { /* same as before */ }
    applyInitialVisibility() { requestAnimationFrame(() => { document.querySelectorAll('.level-card, .leaderboard-card').forEach((c,i) => { c.style.opacity='1'; c.style.transform='none'; c.style.transitionDelay = `${i*0.05}s`; }); }); }
    initScrollAnimation() { this.observer = new IntersectionObserver(e => e.forEach(en => en.isIntersecting && en.target.classList.add('visible')), {threshold:0.1}); }
    observeNewCards() { if(this.observer) document.querySelectorAll('.leaderboard-card:not(.visible), .level-card:not(.visible)').forEach(el => this.observer.observe(el)); }
    render() { this.renderLevels('speedrun'); this.renderLevels('hard'); this.renderLeaderboard(); this.renderFAQ(); }
}

document.addEventListener('DOMContentLoaded', () => new URLSApp());
