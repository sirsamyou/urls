// script.js
class URLSApp {
    constructor() {
        this.speedrunLevels = [];
        this.hardLevels = [];
        this.creators = new Map(); // creator → {levels:[], avgRating, totalLevels}
        this.currentPage = 'speedrun';
        this.init();
    }

    async init() {
        await this.loadData();
        this.aggregateCreators();
        this.calculateLeaderboard();
        this.render();
        this.bindEvents();
    }

    async loadData() {
        try {
            this.speedrunLevels = await fetch('speedrun-levels.json').then(r=>r.json());
            this.hardLevels     = await fetch('hard-levels.json').then(r=>r.json());
        } catch (e) { console.error('Load error:', e); }
    }

    aggregateCreators() {
        const all = [...this.speedrunLevels, ...this.hardLevels];
        all.forEach(lvl => {
            const c = lvl.creator;
            if (!this.creators.has(c)) this.creators.set(c, {levels:[], total:0, count:0});
            const data = this.creators.get(c);
            data.levels.push(lvl);

            const sum = lvl.type==='speedrun'
                ? lvl.ratings.gameplay + lvl.ratings.design
                : lvl.ratings.speedrun + lvl.ratings.design + lvl.ratings.difficulty;
            const cnt = lvl.type==='speedrun' ? 2 : 3;
            data.total += sum/cnt;
            data.count++;
        });
        this.creators.forEach(d => {
            d.avgRating = d.total / d.count;
            d.totalLevels = d.levels.length;
        });
    }

    calculateLeaderboard() {
        const sorted = [...this.creators.entries()].sort(([,a],[,b])=>b.avgRating-a.avgRating);
        sorted.forEach(([,d],i)=> d.position = i+1);
    }

    bindEvents() {
        // navigation
        document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',e=>{
            e.preventDefault(); this.switchPage(e.target.dataset.page);
        }));

        // speedrun controls
        document.getElementById('speedrun-search').addEventListener('input',e=>this.filterSort('speedrun',e.target.value,document.getElementById('speedrun-sort').value));
        document.getElementById('speedrun-sort').addEventListener('change',e=>this.filterSort('speedrun',document.getElementById('speedrun-search').value,e.target.value));

        // hard controls
        document.getElementById('hard-search').addEventListener('input',e=>this.filterSort('hard',e.target.value,document.getElementById('hard-sort').value));
        document.getElementById('hard-sort').addEventListener('change',e=>this.filterSort('hard',document.getElementById('hard-search').value,e.target.value));

        // modal close
        document.querySelectorAll('.close').forEach(c=>c.addEventListener('click',()=>this.closeModal()));
        window.addEventListener('click',e=>{ if(e.target.classList.contains('modal')) this.closeModal(); });
    }

    switchPage(p){
        document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'));
        document.getElementById(p).classList.add('active');
        document.querySelectorAll('.nav a').forEach(a=>a.classList.remove('active'));
        document.querySelector(`[data-page="${p}"]`).classList.add('active');
        if(p==='leaderboard') this.renderLeaderboard();
        else this.renderLevels(p);
        this.currentPage = p;
    }

    filterSort(type,search,sort){
        let list = type==='speedrun'? [...this.speedrunLevels] : [...this.hardLevels];
        if(search) list = list.filter(l=>l.name.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase()));
        if(sort==='rated'){
            list.sort((a,b)=> {
                const avgA = Object.values(a.ratings).reduce((s,v)=>s+v,0)/Object.keys(a.ratings).length;
                const avgB = Object.values(b.ratings).reduce((s,v)=>s+v,0)/Object.keys(b.ratings).length;
                return avgB-avgA;
            });
        } else {
            list.sort((a,b)=> new Date(b.created)-new Date(a.created));
        }
        this.renderList(type,list);
    }

    renderLevels(type){ this.filterSort(type,'','recent'); }

    renderList(type,levels){
        const container = document.getElementById(type==='speedrun'?'speedrun-list':'hard-list');
        container.innerHTML = levels.map(l=>`
            <div class="level-card" data-id="${l.id}" data-type="${type}">
                <img src="${l.thumbnail}" alt="${l.name}">
                <div class="level-info">
                    <h3>${l.name}</h3>
                    <p><strong>Creator:</strong> <span class="creator-link" data-creator="${l.creator}">${l.creator}</span></p>
                    <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                    <p class="rating">Avg: ${(Object.values(l.ratings).reduce((s,v)=>s+v,0)/Object.keys(l.ratings).length).toFixed(1)}/10</p>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.level-card').forEach(card=>{
            card.addEventListener('click',e=>{
                if(e.target.classList.contains('creator-link')) return;
                this.showLevel(card.dataset.type, card.dataset.id);
            });
        });
        container.querySelectorAll('.creator-link').forEach(l=>l.addEventListener('click',e=>{
            e.stopPropagation(); this.showCreator(e.target.dataset.creator);
        }));
    }

    showLevel(type,id){
        const list = type==='speedrun'? this.speedrunLevels : this.hardLevels;
        const lvl = list.find(l=>l.id==id);
        if(!lvl) return;
        const ratings = Object.entries(lvl.ratings).map(([k,v])=>`<strong>${k.charAt(0).toUpperCase()+k.slice(1)}:</strong> ${v}/10`).join('<br>');
        document.getElementById('level-detail').innerHTML = `
            <img src="${lvl.thumbnail}" alt="${lvl.name}">
            <h2>${lvl.name}</h2>
            <p><strong>Creator:</strong> <span class="creator-link" data-creator="${lvl.creator}">${lvl.creator}</span></p>
            <p><strong>ID:</strong> ${lvl.id}</p>
            <p><strong>Link:</strong> <a href="${lvl.link}" target="_blank">Play Level</a></p>
            <p><strong>Created:</strong> ${new Date(lvl.created).toLocaleDateString()}</p>
            <div class="ratings"><h3>Ratings</h3>${ratings}</div>
        `;
        document.querySelector('#level-modal .creator-link').addEventListener('click',e=>{
            this.closeModal(); this.showCreator(e.target.dataset.creator);
        });
        document.getElementById('level-modal').style.display='block';
    }

    showCreator(name){
        const data = this.creators.get(name);
        if(!data) return;
        let levels = [...data.levels];
        levels.sort((a,b)=>new Date(b.created)-new Date(a.created));

        const render = (search='',sort='recent')=>{
            let filtered = levels.filter(l=>l.name.toLowerCase().includes(search.toLowerCase()));
            if(sort==='rated'){
                filtered.sort((a,b)=> {
                    const avgA = Object.values(a.ratings).reduce((s,v)=>s+v,0)/Object.keys(a.ratings).length;
                    const avgB = Object.values(b.ratings).reduce((s,v)=>s+v,0)/Object.keys(b.ratings).length;
                    return avgB-avgA;
                });
            } else {
                filtered.sort((a,b)=>new Date(b.created)-new Date(a.created));
            }
            const grid = document.querySelector('#creator-detail .levels-grid');
            grid.innerHTML = filtered.map(l=>`
                <div class="level-card" data-id="${l.id}" data-type="${l.type}">
                    <img src="${l.thumbnail}" alt="${l.name}">
                    <div class="level-info">
                        <h3>${l.name}</h3>
                        <p><strong>Type:</strong> ${l.type.charAt(0).toUpperCase()+l.type.slice(1)}</p>
                        <p><strong>Created:</strong> ${new Date(l.created).toLocaleDateString()}</p>
                        <p class="rating">Avg: ${(Object.values(l.ratings).reduce((s,v)=>s+v,0)/Object.keys(l.ratings).length).toFixed(1)}/10</p>
                    </div>
                </div>
            `).join('');
            grid.querySelectorAll('.level-card').forEach(c=>c.addEventListener('click',()=>{
                this.closeModal(); this.showLevel(c.dataset.type, c.dataset.id);
            }));
        };

        document.getElementById('creator-detail').innerHTML = `
            <h2>${name}</h2>
            <p><strong>Total Levels:</strong> ${data.totalLevels}</p>
            <p><strong>Leaderboard Position:</strong> #${data.position}</p>
            <p><strong>Avg Rating:</strong> ${data.avgRating.toFixed(1)}/10</p>
            <div class="creator-levels">
                <h3>Levels</h3>
                <div class="controls">
                    <input type="text" id="creator-search" placeholder="Search...">
                    <select id="creator-sort"><option value="recent">Most Recent</option><option value="rated">Best Rated</option></select>
                </div>
                <div class="levels-grid"></div>
            </div>
        `;
        const s = document.getElementById('creator-search');
        const o = document.getElementById('creator-sort');
        s.addEventListener('input',()=>render(s.value,o.value));
        o.addEventListener('change',()=>render(s.value,o.value));
        render();
        document.getElementById('creator-modal').style.display='block';
    }

    closeModal(){ document.querySelectorAll('.modal').forEach(m=>m.style.display='none'); }

    renderLeaderboard(){
        const sorted = [...this.creators.entries()].sort(([,a],[,b])=>b.avgRating-a.avgRating);
        const container = document.getElementById('leaderboard-list');
        container.innerHTML = sorted.map(([c,d])=>`
            <div class="leaderboard-card">
                <div>
                    <h3><span class="creator-link" data-creator="${c}">${c}</span></h3>
                    <p class="avg-rating">Avg: ${d.avgRating.toFixed(1)}/10 | Levels: ${d.totalLevels}</p>
                </div>
                <span class="position">#${d.position}</span>
            </div>
        `).join('');
        container.querySelectorAll('.creator-link').forEach(l=>l.addEventListener('click',e=>{
            e.preventDefault(); this.showCreator(e.target.dataset.creator);
        }));
    }

    render(){ this.renderLevels('speedrun'); this.renderLevels('hard'); this.renderLeaderboard(); }
}

document.addEventListener('DOMContentLoaded',()=>new URLSApp());
