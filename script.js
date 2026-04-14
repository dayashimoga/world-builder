/* world-builder */
'use strict';
(function(){
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    if(typeof QU !== 'undefined') QU.init({ kofi: true, discover: true });
    
    const canvas=$('#worldCanvas'),ctx=canvas.getContext('2d');
    let seed=42;
    function rng(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
    function genTerrain(){
        seed=Math.floor(Math.random()*99999);
        const w=600,h=400; ctx.fillStyle='#1a3a5c'; ctx.fillRect(0,0,w,h);
        // Generate height map
        for(let x=0;x<w;x+=4){for(let y=0;y<h;y+=4){
            const nx=x/w-0.5,ny=y/h-0.5;
            const v=Math.sin(nx*10+rng()*2)*Math.cos(ny*8+rng()*2)*0.5+0.5+rng()*0.3;
            if(v>0.7){ctx.fillStyle='#a0a0a0';} // mountains
            else if(v>0.55){ctx.fillStyle='#228B22';} // forest
            else if(v>0.45){ctx.fillStyle='#90EE90';} // plains
            else if(v>0.35){ctx.fillStyle='#f4d03f';} // beach
            else{ctx.fillStyle='#2980b9';} // water
            ctx.fillRect(x,y,4,4);
        }}
        // Cities
        const cities=[]; for(let i=0;i<5;i++){const cx=50+rng()*500,cy=50+rng()*300; cities.push({x:cx,y:cy}); ctx.fillStyle='#e74c3c'; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='10px Inter'; ctx.fillText(genCityName(),cx+8,cy+4);}
        // Info
        const biomes=['Temperate Forest','Arctic Tundra','Desert Plains','Tropical Islands','Volcanic Highlands'];
        $('#worldInfo').innerHTML='<div style="padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;"><strong>Biome:</strong> '+biomes[Math.floor(rng()*biomes.length)]+'<br><strong>Population:</strong> '+Math.floor(rng()*1000000).toLocaleString()+'<br><strong>Cities:</strong> '+cities.length+'<br><strong>Age:</strong> '+Math.floor(rng()*10000)+' years</div>';
    }
    const sylA=['Ara','Dor','El','Fa','Gon','Ith','Kha','Lor','Mon','Nev','Or','Pha','Quel','Ren','Syl','Thar','Un','Val','Wyr','Zan'];
    const sylB=['dor','eth','ion','mar','nas','oth','rin','shan','thas','wen','zar','lor','mith','dal','gor'];
    function genCityName(){return sylA[Math.floor(rng()*sylA.length)]+sylB[Math.floor(rng()*sylB.length)];}
    $('#genWorld').addEventListener('click',genTerrain);
    $('#genName').addEventListener('click',()=>{const name=genCityName()+' — The '+['Ancient','Eternal','Lost','Hidden','Sacred'][Math.floor(rng()*5)]+' '+['Kingdom','Empire','Republic','Realm','Dominion'][Math.floor(rng()*5)]; alert('Your world: '+name);});
    genTerrain();

})();
