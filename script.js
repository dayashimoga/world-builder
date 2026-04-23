/* world-builder */
'use strict';
(function(){
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    if(typeof QU !== 'undefined') QU.init({ kofi: true, discover: true });
    
    const canvas = $('#worldCanvas'), ctx = canvas.getContext('2d');
    const width = 800, height = 600;
    
    // Value Noise implementation
    function Noise2D(seed) {
        this.seed = seed;
        this.hash = function(x, y) {
            let h = this.seed + x * 374761393 + y * 668265263;
            h = (h ^ (h >> 13)) * 1274126177;
            return (h ^ (h >> 16)) / 4294967296.0 + 0.5; // 0.0 to 1.0
        };
        this.lerp = function(a, b, t) { return a + t * (b - a); };
        this.fade = function(t) { return t * t * t * (t * (t * 6 - 15) + 10); };
        this.get = function(x, y) {
            let ix = Math.floor(x), iy = Math.floor(y);
            let fx = x - ix, fy = y - iy;
            let u = this.fade(fx), v = this.fade(fy);
            let n00 = this.hash(ix, iy), n10 = this.hash(ix+1, iy);
            let n01 = this.hash(ix, iy+1), n11 = this.hash(ix+1, iy+1);
            let nx0 = this.lerp(n00, n10, u);
            let nx1 = this.lerp(n01, n11, u);
            return this.lerp(nx0, nx1, v);
        };
        this.fbm = function(x, y, octaves, persistence, lacunarity) {
            let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
            for(let i=0; i<octaves; i++) {
                total += this.get(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }
            return total / maxValue;
        };
    }

    let elevationMap = [], tempMap = [], moistureMap = [], biomeMap = [], cities = [], territories = [];
    let noiseE, noiseT, noiseM;
    const PIXEL_SIZE = 4; // Render resolution
    const cols = width / PIXEL_SIZE;
    const rows = height / PIXEL_SIZE;

    const BIOMES = {
        DEEP_OCEAN: { c: '#0b264a', name: 'Deep Ocean' },
        OCEAN: { c: '#14467d', name: 'Ocean' },
        SHALLOWS: { c: '#2373ba', name: 'Shallows' },
        BEACH: { c: '#e5d9a9', name: 'Beach' },
        SCORCHED: { c: '#545454', name: 'Scorched' },
        BARE: { c: '#888888', name: 'Bare' },
        TUNDRA: { c: '#c4d4c4', name: 'Tundra' },
        SNOW: { c: '#ffffff', name: 'Snow' },
        TEMPERATE_DESERT: { c: '#c9d29b', name: 'Temperate Desert' },
        SHRUBLAND: { c: '#889977', name: 'Shrubland' },
        GRASSLAND: { c: '#88aa55', name: 'Grassland' },
        TEMPERATE_DECIDUOUS_FOREST: { c: '#679459', name: 'Deciduous Forest' },
        TEMPERATE_RAIN_FOREST: { c: '#448855', name: 'Temperate Rain Forest' },
        SUBTROPICAL_DESERT: { c: '#d2b98b', name: 'Subtropical Desert' },
        TROPICAL_SEASONAL_FOREST: { c: '#559944', name: 'Seasonal Forest' },
        TROPICAL_RAIN_FOREST: { c: '#337744', name: 'Tropical Rain Forest' },
        TAIGA: { c: '#99aa77', name: 'Taiga' }
    };

    function getBiome(e, t, m, seaLevel) {
        if (e < seaLevel - 0.2) return BIOMES.DEEP_OCEAN;
        if (e < seaLevel - 0.05) return BIOMES.OCEAN;
        if (e < seaLevel) return BIOMES.SHALLOWS;
        if (e < seaLevel + 0.03) return BIOMES.BEACH;

        if (e > 0.85) {
            if (m < 0.1) return BIOMES.SCORCHED;
            if (m < 0.2) return BIOMES.BARE;
            if (m < 0.5) return BIOMES.TUNDRA;
            return BIOMES.SNOW;
        }
        if (e > 0.65) {
            if (m < 0.33) return BIOMES.TEMPERATE_DESERT;
            if (m < 0.66) return BIOMES.SHRUBLAND;
            return BIOMES.TAIGA;
        }
        if (t < 0.33) {
            if (m < 0.16) return BIOMES.TEMPERATE_DESERT;
            if (m < 0.50) return BIOMES.GRASSLAND;
            if (m < 0.83) return BIOMES.TEMPERATE_DECIDUOUS_FOREST;
            return BIOMES.TEMPERATE_RAIN_FOREST;
        }
        // t >= 0.33 (Warmer)
        if (m < 0.16) return BIOMES.SUBTROPICAL_DESERT;
        if (m < 0.33) return BIOMES.GRASSLAND;
        if (m < 0.66) return BIOMES.TROPICAL_SEASONAL_FOREST;
        return BIOMES.TROPICAL_RAIN_FOREST;
    }

    function generateMaps() {
        const seed = Math.floor(Math.random() * 9999999);
        noiseE = new Noise2D(seed);
        noiseT = new Noise2D(seed + 100);
        noiseM = new Noise2D(seed + 200);

        const seaLevel = parseFloat($('#seaLevel').value);
        const tempBias = parseFloat($('#tempBias').value);
        
        elevationMap = new Array(cols * rows);
        tempMap = new Array(cols * rows);
        moistureMap = new Array(cols * rows);
        biomeMap = new Array(cols * rows);
        
        let scale = 4.0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let nx = x / cols - 0.5, ny = y / rows - 0.5;
                
                // Distance to edge (creates island shape)
                let d = Math.max(Math.abs(nx), Math.abs(ny)) * 2.0; 
                let islandMask = 1.0 - Math.pow(d, 3);
                
                let e = noiseE.fbm(nx * scale, ny * scale, 5, 0.5, 2.0);
                e = (e * islandMask + 0.1) * 0.9;
                
                // Temp based on latitude (y) and noise
                let t = noiseT.fbm(nx * scale * 0.5, ny * scale * 0.5, 3, 0.5, 2.0);
                let latTemp = 1.0 - Math.abs(ny * 2); // Warm equator
                t = t * 0.3 + latTemp * 0.7 + tempBias;
                t -= Math.max(0, e - seaLevel) * 0.5; // Altitude cooling
                
                // Moisture based on noise and temperature
                let m = noiseM.fbm(nx * scale, ny * scale, 4, 0.5, 2.0);
                m = m * 0.8 + (1.0 - t) * 0.2; // Cooler regions tend to hold more moisture relative to evaporation? Simplified.
                
                e = Math.max(0, Math.min(1, e));
                t = Math.max(0, Math.min(1, t));
                m = Math.max(0, Math.min(1, m));
                
                let idx = y * cols + x;
                elevationMap[idx] = e;
                tempMap[idx] = t;
                moistureMap[idx] = m;
                biomeMap[idx] = getBiome(e, t, m, seaLevel);
            }
        }
        
        generateCities(seaLevel);
        render();
    }

    function getRGB(hex) {
        if(hex.startsWith('#')) hex = hex.substring(1);
        return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
    }

    function generateCities(seaLevel) {
        cities = [];
        territories = new Array(cols * rows).fill(-1);
        const cityCount = 8 + Math.floor(Math.random() * 6);
        
        // Find best spots for cities (coastlines, rivers, flat terrain)
        let candidates = [];
        for (let y = 5; y < rows - 5; y++) {
            for (let x = 5; x < cols - 5; x++) {
                let idx = y * cols + x;
                let e = elevationMap[idx];
                if (e <= seaLevel || e > 0.75) continue; // No underwater or high mountain cities
                
                // Habitability score
                let t = tempMap[idx];
                let m = moistureMap[idx];
                let score = 0;
                
                if (t > 0.3 && t < 0.7) score += 5; // Moderate temp
                if (m > 0.4 && m < 0.8) score += 5; // Moderate moisture
                if (e > seaLevel && e < seaLevel + 0.1) score += 10; // Coastal
                
                candidates.push({ x, y, score });
            }
        }
        
        candidates.sort((a,b) => b.score - a.score);
        
        // Place cities far apart
        for(let cand of candidates) {
            if(cities.length >= cityCount) break;
            let tooClose = false;
            for(let c of cities) {
                let dist = Math.hypot(c.x - cand.x, c.y - cand.y);
                if(dist < 30) tooClose = true;
            }
            if(!tooClose) {
                cities.push({
                    x: cand.x, y: cand.y, 
                    name: genCityName(),
                    color: `hsl(${Math.random()*360}, 70%, 50%)`
                });
            }
        }
        
        // Simple Voronoi for borders
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let idx = y * cols + x;
                if(elevationMap[idx] <= seaLevel) continue; // No borders on water
                
                let minDist = Infinity;
                let bestCity = -1;
                for(let i=0; i<cities.length; i++) {
                    // Distance modified by elevation (mountains are hard to cross)
                    let d = Math.hypot(x - cities[i].x, y - cities[i].y);
                    let e = elevationMap[idx];
                    let moveCost = e > 0.7 ? 3 : (e > 0.6 ? 2 : 1);
                    let dist = d * moveCost;
                    
                    if(dist < minDist) { minDist = dist; bestCity = i; }
                }
                if(minDist < 40) territories[idx] = bestCity; // Max territory size
            }
        }
    }

    function render() {
        const viewMode = $('#viewMode').value;
        const showCities = $('#showCities').checked;
        const showBorders = $('#showBorders').checked;
        const seaLevel = parseFloat($('#seaLevel').value);
        
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let idx = y * cols + x;
                let rgb = [0,0,0];
                
                if (viewMode === 'biome') {
                    rgb = getRGB(biomeMap[idx].c);
                    // Add some shading based on elevation
                    let e = elevationMap[idx];
                    if(e > seaLevel) {
                        let shade = 0.8 + (e - seaLevel) * 0.5;
                        rgb = [rgb[0]*shade, rgb[1]*shade, rgb[2]*shade];
                    }
                } else if (viewMode === 'elevation') {
                    let e = elevationMap[idx];
                    if (e <= seaLevel) {
                        rgb = [0, 0, Math.floor(e/seaLevel * 200)];
                    } else {
                        let v = Math.floor((e - seaLevel)/(1.0 - seaLevel) * 255);
                        rgb = [v,v,v];
                    }
                } else if (viewMode === 'temperature') {
                    let t = tempMap[idx];
                    rgb = [Math.floor(t*255), 0, Math.floor((1-t)*255)];
                } else if (viewMode === 'moisture') {
                    let m = moistureMap[idx];
                    rgb = [Math.floor((1-m)*200), Math.floor((1-m)*200), 255];
                }
                
                // Draw pixels
                for(let dy=0; dy<PIXEL_SIZE; dy++) {
                    for(let dx=0; dx<PIXEL_SIZE; dx++) {
                        let px = x * PIXEL_SIZE + dx;
                        let py = y * PIXEL_SIZE + dy;
                        let pIdx = (py * width + px) * 4;
                        data[pIdx] = rgb[0];
                        data[pIdx+1] = rgb[1];
                        data[pIdx+2] = rgb[2];
                        data[pIdx+3] = 255;
                        
                        // Border overlay
                        if(showBorders && viewMode === 'biome' && territories[idx] !== -1) {
                            // Check neighbors for border
                            let isBorder = false;
                            if(x > 0 && territories[idx] !== territories[idx-1]) isBorder = true;
                            if(y > 0 && territories[idx] !== territories[idx-cols]) isBorder = true;
                            if(isBorder) {
                                let cRgb = getRGB(cities[territories[idx]].color);
                                data[pIdx] = cRgb[0]; data[pIdx+1] = cRgb[1]; data[pIdx+2] = cRgb[2];
                            }
                        }
                    }
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        
        // Draw cities
        if(showCities && viewMode === 'biome') {
            for(let i=0; i<cities.length; i++) {
                let c = cities[i];
                let cx = c.x * PIXEL_SIZE;
                let cy = c.y * PIXEL_SIZE;
                ctx.fillStyle = c.color;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                
                // Label
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Inter';
                ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
                ctx.fillText(c.name, cx + 8, cy + 4);
                ctx.shadowBlur = 0;
            }
        }
    }

    // ─── Naming & Lore ───
    const sylA=['Ara','Dor','El','Fa','Gon','Ith','Kha','Lor','Mon','Nev','Or','Pha','Quel','Ren','Syl','Thar','Un','Val','Wyr','Zan'];
    const sylB=['dor','eth','ion','mar','nas','oth','rin','shan','thas','wen','zar','lor','mith','dal','gor'];
    function genCityName(){return sylA[Math.floor(Math.random()*sylA.length)]+sylB[Math.floor(Math.random()*sylB.length)];}
    function genWorldName(){return genCityName()+' — The '+['Ancient','Eternal','Lost','Hidden','Sacred','Shattered'][Math.floor(Math.random()*6)]+' '+['Kingdom','Empire','Republic','Realm','Dominion'][Math.floor(Math.random()*5)];}
    
    function generateLore() {
        const name = $('#worldName').value || genWorldName();
        $('#worldName').value = name;
        
        const biomesCount = {};
        biomeMap.forEach(b => { if(!biomesCount[b.name]) biomesCount[b.name]=0; biomesCount[b.name]++; });
        let maxBiome = Object.keys(biomesCount).reduce((a, b) => biomesCount[a] > biomesCount[b] && a!=='Ocean' && a!=='Deep Ocean' && a!=='Shallows' ? a : b);
        
        let cNames = cities.map(c=>c.name);
        let lore = `Welcome to the world of ${name}.\n\n`;
        lore += `This land is primarily defined by its massive ${maxBiome} regions. `;
        if(cities.length > 0) {
            lore += `Civilization has taken root here, with ${cities.length} major territories. The great capital of ${cNames[0]} acts as the primary hub of trade and culture, while ${cNames[1] || 'other cities'} fiercely defend their borders.\n\n`;
            lore += `Historically, the inhabitants of ${cNames[0]} fought a long war over the fertile lands against the coalition of ${cNames[cities.length-1]}. `;
        }
        lore += `Legends say that beneath the deepest oceans, forgotten relics of the precursors still lie hidden, waiting for an intrepid adventurer to unearth them.`;
        
        $('#loreEditor').value = lore;
    }

    // Interactions
    $('#genWorld').addEventListener('click', generateMaps);
    $('#viewMode').addEventListener('change', render);
    $('#showCities').addEventListener('change', render);
    $('#showBorders').addEventListener('change', render);
    $('#seaLevel').addEventListener('input', generateMaps);
    $('#tempBias').addEventListener('input', generateMaps);
    $('#genLoreBtn').addEventListener('click', generateLore);
    
    // Tooltip
    const tooltip = $('#tooltip');
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = Math.floor((e.clientX - rect.left) / PIXEL_SIZE);
        const py = Math.floor((e.clientY - rect.top) / PIXEL_SIZE);
        if(px >= 0 && px < cols && py >= 0 && py < rows) {
            let idx = py * cols + px;
            let b = biomeMap[idx];
            let tIdx = territories[idx];
            let terrStr = (tIdx !== -1 && b.name !== 'Ocean' && b.name !== 'Deep Ocean') ? `<br><span style="color:${cities[tIdx].color}">Territory of ${cities[tIdx].name}</span>` : '';
            tooltip.innerHTML = `<strong>${b.name}</strong><br>Elevation: ${Math.round(elevationMap[idx]*100)}%<br>Temp: ${Math.round(tempMap[idx]*100)}%` + terrStr;
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
            tooltip.style.display = 'block';
        } else {
            tooltip.style.display = 'none';
        }
    });
    canvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');

    // Init
    generateMaps();
    generateLore();

})();
